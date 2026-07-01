"""
Deep Learning LSTM for Moisture Stress Detection
Fetches REAL historical time-series data from Google Earth Engine,
Trains a PyTorch LSTM model, and predicts Moisture Stress (VCI equivalent).
"""

import datetime
import logging
import time
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from pathlib import Path
from sklearn.preprocessing import MinMaxScaler
import joblib

logger = logging.getLogger(__name__)

# Ensure weights directory exists
WEIGHTS_DIR = Path(__file__).resolve().parent / "weights"
WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = WEIGHTS_DIR / "lstm_vci_model.pth"
SCALER_PATH = WEIGHTS_DIR / "lstm_scaler.joblib"

# In-memory model cache — avoids re-loading weights on every API call
_LSTM_MODEL_CACHE = None
_LSTM_SCALER_CACHE = None

# ──────────────────────────────────────────
# 1. Fetch REAL Data from Google Earth Engine
# ──────────────────────────────────────────
def fetch_real_gee_data(num_points=30, months_back=6):
    """
    Fetches real time-series data for random agricultural points across India.
    Features per month: [NDVI, NDWI, Precipitation]
    Target: VCI calculated from the time-series.
    """
    try:
        import ee
        ee.Initialize()
    except Exception as e:
        logger.warning("GEE not initialized. Please run `earthengine authenticate`: %s", e)
        return (
            np.empty((0, months_back, 3), dtype=np.float32),
            np.empty((0, 1), dtype=np.float32),
        )

    logger.info("Fetching real GEE time-series data for %s points...", num_points)
    
    # Random sampling bounding box for India
    # [min_lon, min_lat, max_lon, max_lat]
    bbox = [70.0, 10.0, 90.0, 28.0]
    
    # Generate random points
    points = []
    for _ in range(num_points):
        lon = np.random.uniform(bbox[0], bbox[2])
        lat = np.random.uniform(bbox[1], bbox[3])
        points.append(ee.Geometry.Point([lon, lat]))
        
    features = []
    targets = []
    
    # Dates
    end_date = datetime.date.today()
    start_date = end_date - datetime.timedelta(days=30 * months_back)
    
    # Collections
    s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
        .filterDate(start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')) \
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
        
    chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY') \
        .filterDate(start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
        
    # Process each point
    for i, pt in enumerate(points):
        try:
            # We want a time series of `months_back` steps
            time_series = []
            
            # Extract monthly values
            for m in range(months_back):
                m_start = start_date + datetime.timedelta(days=30 * m)
                m_end = m_start + datetime.timedelta(days=30)
                
                # NDVI & NDWI
                s2_month = s2.filterDate(m_start.strftime('%Y-%m-%d'), m_end.strftime('%Y-%m-%d')).median()
                ndvi = s2_month.normalizedDifference(['B8', 'B4']).rename('NDVI')
                ndwi = s2_month.normalizedDifference(['B8', 'B11']).rename('NDWI')
                
                # Precipitation
                precip = chirps.filterDate(m_start.strftime('%Y-%m-%d'), m_end.strftime('%Y-%m-%d')).sum().rename('precip')
                
                # Combine
                combined = ndvi.addBands(ndwi).addBands(precip)
                
                # Extract point
                val = combined.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=pt,
                    scale=1000
                ).getInfo()
                
                # Handle missing data
                n = val.get('NDVI', 0) if val.get('NDVI') is not None else 0
                w = val.get('NDWI', 0) if val.get('NDWI') is not None else 0
                p = val.get('precip', 0) if val.get('precip') is not None else 0
                
                time_series.append([n, w, p])
            
            # Target: Real VCI calculation based on the series
            ndvis = [ts[0] for ts in time_series]
            ndvi_min = min(ndvis)
            ndvi_max = max(ndvis)
            ndvi_current = ndvis[-1]
            
            if ndvi_max > ndvi_min:
                vci = ((ndvi_current - ndvi_min) / (ndvi_max - ndvi_min)) * 100.0
            else:
                vci = 50.0
                
            features.append(time_series)
            targets.append([vci])
            
            if (i+1) % 5 == 0:
                logger.info("Processed %s/%s locations...", i + 1, num_points)
                
        except Exception as e:
            logger.warning("GEE time-series point skipped: %s", e)
            continue
            
    logger.info("Successfully fetched %s valid time-series samples.", len(features))
    return np.array(features, dtype=np.float32), np.array(targets, dtype=np.float32)


# ──────────────────────────────────────────
# 2. PyTorch LSTM Architecture
# ──────────────────────────────────────────
class MoistureStressLSTM(nn.Module):
    def __init__(self, input_size=3, hidden_size=64, num_layers=2):
        super(MoistureStressLSTM, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        
        # LSTM layer
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=0.2)
        
        # Fully connected layers
        self.fc1 = nn.Linear(hidden_size, 32)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(32, 1) # Output: VCI score (0-100)
        
    def forward(self, x):
        # Initialize hidden state and cell state
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        
        # Forward propagate LSTM
        out, _ = self.lstm(x, (h0, c0))
        
        # Decode the hidden state of the last time step
        out = out[:, -1, :]
        out = self.fc1(out)
        out = self.relu(out)
        out = self.fc2(out)
        return out


# ──────────────────────────────────────────
# 3. Training Script
# ──────────────────────────────────────────
def train_lstm_model():
    """Trains the LSTM model on REAL GEE data."""
    # Fetch data
    X, y = fetch_real_gee_data(num_points=100, months_back=6)
    
    if len(X) < 10:
        logger.info("Not enough valid data fetched. Aborting training.")
        return
        
    # Scale features
    num_samples, seq_len, num_features = X.shape
    X_flat = X.reshape(-1, num_features)
    scaler = MinMaxScaler()
    X_flat_scaled = scaler.fit_transform(X_flat)
    X_scaled = X_flat_scaled.reshape(num_samples, seq_len, num_features)
    
    joblib.dump(scaler, SCALER_PATH)
    logger.info("Saved MinMaxScaler to %s", SCALER_PATH)
        
    # PyTorch Dataset & DataLoader
    dataset = TensorDataset(torch.from_numpy(X_scaled), torch.from_numpy(y))
    dataloader = DataLoader(dataset, batch_size=16, shuffle=True)
    
    model = MoistureStressLSTM()
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.005)
    
    epochs = 100
    logger.info("Training Deep Learning LSTM model for %s epochs...", epochs)
    
    for epoch in range(epochs):
        model.train()
        total_loss = 0
        for batch_X, batch_y in dataloader:
            optimizer.zero_grad()
            outputs = model(batch_X)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            
        if (epoch+1) % 10 == 0:
            logger.info(
                "Epoch [%s/%s], Loss: %.4f",
                epoch + 1,
                epochs,
                total_loss / len(dataloader),
            )
            
    # Save model weights
    torch.save(model.state_dict(), MODEL_PATH)
    logger.info("Model successfully saved to %s", MODEL_PATH)


# ──────────────────────────────────────────
# 4. Inference / Prediction
# ──────────────────────────────────────────
def predict_stress_lstm(time_series: list) -> float:
    """
    Run LSTM inference on a 6-month feature sequence.

    Model weights are loaded from disk only once and cached in memory.
    Args:
        time_series: list of [ndvi, ndwi, precip] rows for consecutive months.
    Returns:
        float: predicted VCI score constrained to [0, 100].
    """
    global _LSTM_MODEL_CACHE
    global _LSTM_SCALER_CACHE
    if _LSTM_MODEL_CACHE is None:
        model = MoistureStressLSTM()
        if MODEL_PATH.exists():
            try:
                model.load_state_dict(
                    torch.load(MODEL_PATH, weights_only=True, map_location="cpu")
                )
                logger.info("LSTM weights loaded from %s", MODEL_PATH)
            except Exception as e:
                logger.warning("LSTM weight load failed, using untrained model: %s", e)
        model.eval()
        _LSTM_MODEL_CACHE = model
        
        if SCALER_PATH.exists():
            try:
                _LSTM_SCALER_CACHE = joblib.load(SCALER_PATH)
            except Exception as e:
                logger.warning("LSTM scaler load failed: %s", e)

    with torch.no_grad():
        x_np = np.array(time_series, dtype=np.float32)
        if _LSTM_SCALER_CACHE is not None:
            x_np = _LSTM_SCALER_CACHE.transform(x_np)
        x = torch.tensor([x_np], dtype=torch.float32)
        vci = float(_LSTM_MODEL_CACHE(x).item())

    return max(0.0, min(100.0, vci))

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    # Run this file to fetch data and train the model!
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--train', action='store_true', help='Train the model with real GEE data')
    args = parser.parse_args()
    
    if args.train:
        train_lstm_model()
    else:
        logger.info("Run with --train to fetch GEE data and train the LSTM.")
