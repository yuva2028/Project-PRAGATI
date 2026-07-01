"""
Synthetic LSTM Training Script
Trains the MoistureStressLSTM on realistic synthetic Sentinel-2/CHIRPS-style
time-series data WITHOUT requiring Google Earth Engine authentication.

Saves weights to: ml/weights/lstm_vci_model.pth

Run from the project root:
    python -m ml.train_lstm_synthetic
"""

import os
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

# Import the model class from the existing module (avoids duplication)
from ml.lstm_moisture import MoistureStressLSTM, MODEL_PATH


def generate_synthetic_data(num_samples: int = 500, seq_len: int = 6, seed: int = 42):
    """
    Generates realistic synthetic training data that mirrors what GEE returns.

    Each sample is a sequence of monthly observations:
        [NDVI, NDWI, Precipitation]

    Target: VCI computed from the NDVI sequence using the same formula as GEE.

    Four archetypal patterns are simulated:
      1. Healthy crop (Kharif season growth + decline)
      2. Drought stress (stunted growth, low NDVI)
      3. Waterlogged / recovery
      4. Mixed/other
    """
    rng = np.random.default_rng(seed)

    features = []
    targets = []

    for i in range(num_samples):
        pattern = i % 4

        if pattern == 0:
            # Healthy Kharif: NDVI rises to 0.7+ then declines
            base_ndvi = rng.uniform(0.15, 0.22, size=seq_len)
            trend = np.linspace(0, rng.uniform(0.45, 0.60), seq_len)
            ndvi_seq = np.clip(base_ndvi + trend + rng.normal(0, 0.02, seq_len), 0.05, 0.90)
            precip = rng.uniform(40, 120, seq_len)  # monsoon rainfall

        elif pattern == 1:
            # Drought stress: NDVI stays low all season
            base_ndvi = rng.uniform(0.10, 0.18, size=seq_len)
            trend = np.linspace(0, rng.uniform(0.05, 0.20), seq_len)
            ndvi_seq = np.clip(base_ndvi + trend + rng.normal(0, 0.015, seq_len), 0.05, 0.40)
            precip = rng.uniform(0, 20, seq_len)  # very low rain

        elif pattern == 2:
            # Recovery: starts stressed, improves after rains
            ndvi_seq = np.array([
                rng.uniform(0.10, 0.20),
                rng.uniform(0.12, 0.22),
                rng.uniform(0.20, 0.35),
                rng.uniform(0.35, 0.55),
                rng.uniform(0.50, 0.70),
                rng.uniform(0.55, 0.75),
            ]) + rng.normal(0, 0.02, seq_len)
            ndvi_seq = np.clip(ndvi_seq, 0.05, 0.90)
            precip = np.array([5, 10, 50, 80, 70, 60]) + rng.normal(0, 5, seq_len)

        else:
            # Mixed / Others: flat or erratic
            ndvi_seq = rng.uniform(0.15, 0.55, size=seq_len) + rng.normal(0, 0.03, seq_len)
            ndvi_seq = np.clip(ndvi_seq, 0.05, 0.85)
            precip = rng.uniform(5, 80, seq_len)

        # NDWI is negatively correlated with dryness; approximate from NDVI + noise
        ndwi_seq = np.clip(ndvi_seq * 0.6 - 0.1 + rng.normal(0, 0.03, seq_len), -0.5, 0.5)

        # VCI target: computed from this sequence's own NDVI range
        ndvi_min = ndvi_seq.min()
        ndvi_max = ndvi_seq.max()
        ndvi_current = ndvi_seq[-1]  # last timestep = "current"
        if ndvi_max > ndvi_min:
            vci = (ndvi_current - ndvi_min) / (ndvi_max - ndvi_min) * 100.0
        else:
            vci = 50.0
        vci = float(np.clip(vci, 0.0, 100.0))

        # Stack into time series shape: (seq_len, 3)
        seq = np.stack([ndvi_seq, ndwi_seq, precip], axis=1).astype(np.float32)
        features.append(seq)
        targets.append([vci])

    return (
        np.array(features, dtype=np.float32),   # (N, seq_len, 3)
        np.array(targets, dtype=np.float32),     # (N, 1)
    )


def train(num_samples: int = 600, epochs: int = 120, batch_size: int = 32, lr: float = 0.003):
    print("=" * 55)
    print("  PRAGATI LSTM Synthetic Training")
    print("=" * 55)

    X, y = generate_synthetic_data(num_samples=num_samples)
    print(f"  Dataset: {X.shape[0]} samples | seq_len={X.shape[1]} | features={X.shape[2]}")
    print(f"  VCI range: {y.min():.1f} – {y.max():.1f}")

    dataset = TensorDataset(torch.from_numpy(X), torch.from_numpy(y))
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    model = MoistureStressLSTM(input_size=3, hidden_size=64, num_layers=2)
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=10, factor=0.5)

    best_loss = float("inf")
    for epoch in range(epochs):
        model.train()
        total_loss = 0.0
        for batch_X, batch_y in dataloader:
            optimizer.zero_grad()
            out = model(batch_X)
            loss = criterion(out, batch_y)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            total_loss += loss.item()

        avg_loss = total_loss / len(dataloader)
        scheduler.step(avg_loss)

        if avg_loss < best_loss:
            best_loss = avg_loss

        if (epoch + 1) % 20 == 0 or epoch == 0:
            print(f"  Epoch [{epoch+1:3d}/{epochs}]  Loss: {avg_loss:.4f}  Best: {best_loss:.4f}")

    # Save weights
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    torch.save(model.state_dict(), MODEL_PATH)
    print(f"\n  [OK] Weights saved -> {MODEL_PATH}")
    print(f"  Final training loss: {best_loss:.4f}")
    print("=" * 55)

    # Quick sanity-check inference
    model.eval()
    with torch.no_grad():
        # Healthy sequence should produce high VCI
        healthy_seq = torch.tensor(
            [[[0.15, 0.0, 60.0], [0.30, 0.1, 80.0], [0.50, 0.2, 90.0],
              [0.65, 0.25, 70.0], [0.72, 0.22, 50.0], [0.68, 0.20, 40.0]]],
            dtype=torch.float32
        )
        # Stressed sequence should produce low VCI
        stress_seq = torch.tensor(
            [[[0.12, -0.1, 5.0], [0.13, -0.1, 3.0], [0.14, -0.1, 2.0],
              [0.13, -0.1, 4.0], [0.12, -0.1, 1.0], [0.11, -0.1, 0.0]]],
            dtype=torch.float32
        )
        healthy_vci = float(model(healthy_seq).clamp(0, 100).item())
        stress_vci  = float(model(stress_seq).clamp(0, 100).item())

    print("  Sanity check:")
    print(f"    Healthy sequence  -> VCI = {healthy_vci:.1f}  (expect > 40)")
    print(f"    Stressed sequence -> VCI = {stress_vci:.1f}  (expect < 60)")
    print()


if __name__ == "__main__":
    train()
