"""
API Router: Weather Forecast (Open-Meteo integration)
GET /api/weather-forecast
"""

import logging
from typing import Optional
from datetime import datetime
from fastapi import APIRouter
from fastapi_cache.decorator import cache

logger = logging.getLogger(__name__)

router = APIRouter()

# Fallback forecast data (when Open-Meteo is unavailable or for demo)
# Represents typical Karnataka Kharif monsoon conditions
def generate_fallback_forecast(lat: float = 15.3, lng: float = 75.7):
    """Generate realistic 7-day weather forecast for the pilot area."""
    import random
    rng = random.Random(int(datetime.now().timestamp() // 3600))  # Changes hourly

    base_temp = 28 if lat > 14 else 26  # North Karnataka is warmer
    forecasts = []

    for day_offset in range(7):
        date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        from datetime import timedelta
        forecast_date = date + timedelta(days=day_offset)

        temp_max = round(base_temp + rng.uniform(-2, 4), 1)
        temp_min = round(temp_max - rng.uniform(5, 9), 1)
        precipitation = round(rng.uniform(0, 35) if rng.random() > 0.3 else 0, 1)
        precipitation_probability = min(95, max(5, int(precipitation * 3 + rng.uniform(5, 25))))
        humidity = min(95, max(40, int(60 + precipitation * 0.8 + rng.uniform(-10, 15))))
        wind_speed = round(rng.uniform(5, 25), 1)
        cloud_cover = min(100, max(10, int(precipitation_probability * 0.8 + rng.uniform(0, 20))))

        # Weather condition based on precipitation
        if precipitation > 20:
            condition = "Heavy Rain"
            icon = "🌧️"
        elif precipitation > 10:
            condition = "Moderate Rain"
            icon = "🌦️"
        elif precipitation > 2:
            condition = "Light Rain"
            icon = "🌦️"
        elif cloud_cover > 70:
            condition = "Cloudy"
            icon = "☁️"
        elif cloud_cover > 40:
            condition = "Partly Cloudy"
            icon = "⛅"
        else:
            condition = "Sunny"
            icon = "☀️"

        # Irrigation recommendation based on forecast
        if precipitation > 15:
            irrigation_advice = "Defer irrigation — significant rainfall expected"
            irrigation_color = "#10b981"
        elif precipitation > 5:
            irrigation_advice = "Reduce irrigation — moderate rain likely"
            irrigation_color = "#f59e0b"
        elif day_offset == 0:
            irrigation_advice = "Follow advisory schedule — dry conditions"
            irrigation_color = "#ef4444"
        else:
            irrigation_advice = "Monitor conditions"
            irrigation_color = "#64748b"

        # Evapotranspiration estimate (Hargreaves method simplified)
        ra = 38.0  # Extraterrestrial radiation for ~15°N latitude (MJ/m²/day)
        et0_estimate = round(0.0023 * (temp_max - temp_min) ** 0.5 * ((temp_max + temp_min) / 2 + 17.8) * ra / 10, 1)

        forecasts.append({
            "date": forecast_date.strftime("%Y-%m-%d"),
            "day_name": forecast_date.strftime("%A"),
            "day_short": forecast_date.strftime("%a"),
            "temp_max_c": temp_max,
            "temp_min_c": temp_min,
            "precipitation_mm": precipitation,
            "precipitation_probability_pct": precipitation_probability,
            "humidity_pct": humidity,
            "wind_speed_kmh": wind_speed,
            "cloud_cover_pct": cloud_cover,
            "condition": condition,
            "icon": icon,
            "et0_mm": et0_estimate,
            "irrigation_advice": irrigation_advice,
            "irrigation_color": irrigation_color,
        })

    return forecasts


@router.get("/weather-forecast")
@cache(expire=1800)  # 30 min cache
async def get_weather_forecast(lat: float = 15.3, lng: float = 75.7):
    """
    Returns a 7-day weather forecast for the given coordinates.
    Attempts to use Open-Meteo API; falls back to realistic synthetic data.
    """
    forecasts = None
    source = "Open-Meteo API"

    try:
        import httpx
        url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={lat}&longitude={lng}"
            f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,"
            f"precipitation_probability_max,relative_humidity_2m_max,wind_speed_10m_max,"
            f"et0_fao_evapotranspiration,weathercode"
            f"&timezone=Asia/Kolkata&forecast_days=7"
        )

        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(url)
            if response.status_code == 200:
                data = response.json()
                daily = data.get("daily", {})
                dates = daily.get("time", [])
                forecasts = []

                WEATHER_CODES = {
                    0: ("Clear Sky", "☀️"), 1: ("Mainly Clear", "🌤️"),
                    2: ("Partly Cloudy", "⛅"), 3: ("Overcast", "☁️"),
                    45: ("Foggy", "🌫️"), 48: ("Rime Fog", "🌫️"),
                    51: ("Light Drizzle", "🌦️"), 53: ("Moderate Drizzle", "🌦️"),
                    55: ("Dense Drizzle", "🌧️"), 61: ("Slight Rain", "🌦️"),
                    63: ("Moderate Rain", "🌧️"), 65: ("Heavy Rain", "🌧️"),
                    80: ("Rain Showers", "🌧️"), 81: ("Moderate Showers", "🌧️"),
                    82: ("Violent Showers", "⛈️"), 95: ("Thunderstorm", "⛈️"),
                    96: ("Thunderstorm + Hail", "⛈️"), 99: ("Heavy Hail", "⛈️"),
                }

                for i, date_str in enumerate(dates):
                    from datetime import datetime as dt
                    forecast_date = dt.strptime(date_str, "%Y-%m-%d")
                    precip = daily.get("precipitation_sum", [0] * 7)[i] or 0
                    wcode = daily.get("weathercode", [0] * 7)[i] or 0
                    condition, icon = WEATHER_CODES.get(wcode, ("Unknown", "❓"))

                    if precip > 15:
                        irrigation_advice = "Defer irrigation — significant rainfall expected"
                        irrigation_color = "#10b981"
                    elif precip > 5:
                        irrigation_advice = "Reduce irrigation — moderate rain likely"
                        irrigation_color = "#f59e0b"
                    else:
                        irrigation_advice = "Follow advisory schedule — dry conditions"
                        irrigation_color = "#ef4444"

                    forecasts.append({
                        "date": date_str,
                        "day_name": forecast_date.strftime("%A"),
                        "day_short": forecast_date.strftime("%a"),
                        "temp_max_c": daily.get("temperature_2m_max", [30] * 7)[i],
                        "temp_min_c": daily.get("temperature_2m_min", [22] * 7)[i],
                        "precipitation_mm": round(precip, 1),
                        "precipitation_probability_pct": daily.get("precipitation_probability_max", [0] * 7)[i] or 0,
                        "humidity_pct": daily.get("relative_humidity_2m_max", [60] * 7)[i] or 60,
                        "wind_speed_kmh": daily.get("wind_speed_10m_max", [10] * 7)[i] or 10,
                        "cloud_cover_pct": min(100, wcode * 10),
                        "condition": condition,
                        "icon": icon,
                        "et0_mm": daily.get("et0_fao_evapotranspiration", [5] * 7)[i] or 5,
                        "irrigation_advice": irrigation_advice,
                        "irrigation_color": irrigation_color,
                    })

    except Exception as e:
        logger.warning("Open-Meteo API unavailable, using fallback: %s", e)
        forecasts = None
        source = "Simulated Kharif Monsoon Model (Fallback)"

    if not forecasts:
        forecasts = generate_fallback_forecast(lat, lng)
        source = "Simulated Kharif Monsoon Model (Fallback)"

    # Aggregate irrigation intelligence
    total_rain_7d = sum(f["precipitation_mm"] for f in forecasts)
    total_et0_7d = sum(f["et0_mm"] for f in forecasts)
    rain_days = sum(1 for f in forecasts if f["precipitation_mm"] > 2)

    return {
        "status": "success",
        "location": {"lat": lat, "lng": lng},
        "source": source,
        "forecast_days": len(forecasts),
        "summary": {
            "total_precipitation_mm": round(total_rain_7d, 1),
            "total_et0_mm": round(total_et0_7d, 1),
            "net_water_balance_mm": round(total_rain_7d - total_et0_7d, 1),
            "rainy_days": rain_days,
            "irrigation_outlook": (
                "Favorable — rainfall expected to meet crop demand"
                if total_rain_7d > total_et0_7d
                else "Deficit — irrigation needed to supplement rainfall"
            ),
        },
        "daily": forecasts,
    }
