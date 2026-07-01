"""
API Router: Alert Center
GET /api/alerts
GET /api/alerts/summary
"""

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
from fastapi import APIRouter
from fastapi_cache.decorator import cache

logger = logging.getLogger(__name__)

router = APIRouter()


def generate_alert_history(lat: float = None, lng: float = None) -> List[Dict[str, Any]]:
    """Generate realistic alert history for the pilot area."""
    import random
    rng = random.Random(42)

    alert_templates = [
        {
            "type": "CRITICAL_STRESS",
            "severity": "critical",
            "icon": "🚨",
            "title_template": "Severe Moisture Stress Detected — {field}",
            "message_template": "VCI dropped to {vci}% in field {field} ({crop}). Immediate irrigation required within 24 hours to prevent irreversible yield loss.",
            "action": "Irrigate immediately",
            "channel": "SMS + Dashboard",
        },
        {
            "type": "HIGH_STRESS",
            "severity": "high",
            "icon": "⚠️",
            "title_template": "High Stress Alert — {field}",
            "message_template": "Field {field} shows high moisture stress (VCI: {vci}%). {crop} at {stage} stage requires irrigation within 48 hours.",
            "action": "Schedule irrigation",
            "channel": "Dashboard",
        },
        {
            "type": "PEST_WARNING",
            "severity": "high",
            "icon": "🐛",
            "title_template": "Pest Risk Warning — {region}",
            "message_template": "Favorable conditions for {pest} detected in {region} based on temperature ({temp}°C) and humidity ({humidity}%) patterns.",
            "action": "Apply preventive spray",
            "channel": "SMS + WhatsApp",
        },
        {
            "type": "WEATHER_ALERT",
            "severity": "medium",
            "icon": "🌧️",
            "title_template": "Heavy Rainfall Warning — {region}",
            "message_template": "IMD forecasts {rain}mm rainfall in {region} over next 48 hours. Defer irrigation for fields in this zone. Ensure field drainage.",
            "action": "Defer irrigation",
            "channel": "Dashboard",
        },
        {
            "type": "CANAL_ADVISORY",
            "severity": "medium",
            "icon": "🚰",
            "title_template": "Canal Discharge Update — {canal}",
            "message_template": "Recommended {discharge} discharge for {canal} distributary. {gates} gates to be opened at {opening}% capacity.",
            "action": "Coordinate with WRD",
            "channel": "Dashboard",
        },
        {
            "type": "HARVEST_ADVISORY",
            "severity": "low",
            "icon": "🌾",
            "title_template": "Harvest Window Advisory — {field}",
            "message_template": "NDVI decline detected in field {field}. {crop} appears to have reached maturity. Optimal harvest window: next 7-10 days.",
            "action": "Plan harvest",
            "channel": "Dashboard",
        },
        {
            "type": "DATA_UPDATE",
            "severity": "info",
            "icon": "🛰️",
            "title_template": "Satellite Data Refresh Complete",
            "message_template": "New {satellite} pass processed for {region}. {fields} fields updated with latest spectral indices. Next refresh: {next_pass}.",
            "action": "Review dashboard",
            "channel": "Dashboard",
        },
    ]

    fields = ["KAR-F001", "KAR-F002", "KAR-F003", "KAR-F005", "KAR-F009", "KAR-F011"]
    crops = ["Rice", "Maize", "Sugarcane"]
    stages = ["Vegetative", "Flowering", "Maturity"]
    regions = ["Dharwad", "Belgaum", "Raichur", "Shimoga", "Bellary"]
    pests = ["Fall Armyworm", "Stem Borer", "Brown Plant Hopper", "Leaf Folder"]
    canals = ["Krishna Left Bank", "Tungabhadra Right", "Upper Krishna", "Cauvery Delta"]

    alerts = []
    now = datetime.now()

    for i in range(30):
        template = rng.choice(alert_templates)
        hours_ago = rng.uniform(0.5, 168)  # last 7 days
        timestamp = now - timedelta(hours=hours_ago)
        field = rng.choice(fields)
        crop = rng.choice(crops)
        vci = round(rng.uniform(5, 85), 1)
        stage = rng.choice(stages)
        region = rng.choice(regions)

        title = template["title_template"].format(
            field=field, region=region, canal=rng.choice(canals)
        )
        message = template["message_template"].format(
            field=field, crop=crop, vci=vci, stage=stage,
            region=region, pest=rng.choice(pests),
            temp=round(rng.uniform(25, 35), 1),
            humidity=rng.randint(60, 95),
            rain=rng.randint(20, 80),
            discharge=rng.choice(["HIGH", "MEDIUM", "LOW"]),
            canal=rng.choice(canals),
            gates=rng.randint(2, 8),
            opening=rng.choice([30, 45, 60, 80, 100]),
            satellite=rng.choice(["Sentinel-2", "Sentinel-1"]),
            fields=rng.randint(8, 25),
            next_pass=rng.choice(["3 days", "5 days", "Tomorrow"]),
        )

        alerts.append({
            "id": f"ALT-{i+1:04d}",
            "timestamp": timestamp.isoformat(),
            "timestamp_display": timestamp.strftime("%b %d, %H:%M"),
            "hours_ago": round(hours_ago, 1),
            "type": template["type"],
            "severity": template["severity"],
            "icon": template["icon"],
            "title": title,
            "message": message,
            "action": template["action"],
            "channel": template["channel"],
            "field_id": field if "field" in template["title_template"].lower() else None,
            "acknowledged": rng.random() > 0.4,
        })

    # Sort by most recent first
    alerts.sort(key=lambda a: a["hours_ago"])
    return alerts


@router.get("/alerts")
@cache(expire=300)
async def get_alerts(lat: float = None, lng: float = None, severity: str = None):
    """Returns alert history for the pilot area."""
    try:
        alerts = generate_alert_history(lat, lng)

        if severity:
            alerts = [a for a in alerts if a["severity"] == severity.lower()]

        return {
            "status": "success",
            "total_alerts": len(alerts),
            "alerts": alerts,
        }
    except Exception as e:
        logger.error("Alert generation failed: %s", e)
        return {"status": "error", "detail": str(e)}


@router.get("/alerts/summary")
@cache(expire=300)
async def get_alert_summary(lat: float = None, lng: float = None):
    """Returns alert count summary by severity."""
    try:
        alerts = generate_alert_history(lat, lng)

        summary = {
            "critical": len([a for a in alerts if a["severity"] == "critical"]),
            "high": len([a for a in alerts if a["severity"] == "high"]),
            "medium": len([a for a in alerts if a["severity"] == "medium"]),
            "low": len([a for a in alerts if a["severity"] == "low"]),
            "info": len([a for a in alerts if a["severity"] == "info"]),
            "total": len(alerts),
            "unacknowledged": len([a for a in alerts if not a["acknowledged"]]),
        }

        return {
            "status": "success",
            "summary": summary,
        }
    except Exception as e:
        logger.error("Alert summary failed: %s", e)
        return {"status": "error", "detail": str(e)}
