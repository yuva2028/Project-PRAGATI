"""
Irrigation Advisory Engine
Rule-Based System + Water Deficit Estimation
Generates field-level irrigation advisories
"""

import logging
import numpy as np

logger = logging.getLogger(__name__)
_rng = np.random.default_rng(42)

try:
    from project.ml.moisture_model import STRESS_CATEGORIES, get_stress_category
except ImportError:
    from ml.moisture_model import STRESS_CATEGORIES, get_stress_category

# ──────────────────────────────────────────
# Crop Water Requirements (mm/day) by growth stage
# FAO-56 Reference Crop Coefficients (Kc)
# ──────────────────────────────────────────
CROP_KCS = {
    "Rice":      {"Sowing": 1.05, "Vegetative": 1.20, "Flowering": 1.20, "Maturity": 0.90},
    "Maize":     {"Sowing": 0.30, "Vegetative": 1.20, "Flowering": 1.20, "Maturity": 0.35},
    "Sugarcane": {"Sowing": 0.40, "Vegetative": 1.25, "Flowering": 1.25, "Maturity": 0.75},
    "Others":    {"Sowing": 0.50, "Vegetative": 1.00, "Flowering": 1.00, "Maturity": 0.60},
}

# ET0 reference (mm/day) - derived from ERA5 data for Karnataka
REFERENCE_ET0_MM_DAY = 4.5

# ──────────────────────────────────────────
# Advisory Rules
# ──────────────────────────────────────────
ADVISORY_RULES = {
    "Severe Stress": {
        "urgency": "IMMEDIATE",
        "message": "Irrigate Immediately (within 24 hours)",
        "within_days": 1,
        "priority": "CRITICAL",
        "color": "#dc2626"
    },
    "High Stress": {
        "urgency": "URGENT",
        "message": "Irrigate within 2 Days",
        "within_days": 2,
        "priority": "HIGH",
        "color": "#f97316"
    },
    "Moderate Stress": {
        "urgency": "MODERATE",
        "message": "Irrigate within 3-5 Days",
        "within_days": 4,
        "priority": "MEDIUM",
        "color": "#eab308"
    },
    "Low Stress": {
        "urgency": "LOW",
        "message": "Irrigate within 7 Days",
        "within_days": 7,
        "priority": "LOW",
        "color": "#84cc16"
    },
    "Healthy": {
        "urgency": "NONE",
        "message": "No Irrigation Needed",
        "within_days": None,
        "priority": "NONE",
        "color": "#22c55e"
    },
}

# ──────────────────────────────────────────
# Core Water Deficit Calculation
# ──────────────────────────────────────────
def get_regional_et0(period_days: int = 8) -> float:
    """Fetch real MODIS ET if available, otherwise use reference."""
    try:
        from gee.modis import get_modis_et_stats
        base_et = get_modis_et_stats() 
        if base_et is not None:
            # MOD16A2 is an 8-day total ET.
            return (base_et / 8) * period_days
    except Exception as e:
        print(f"[WARN] MODIS ET0 fetch failed, using reference ET0: {e}")
    return REFERENCE_ET0_MM_DAY * period_days

def compute_crop_water_requirement(crop: str, stage: str, regional_et0: float) -> float:
    """ETc = ET0 × Kc (mm over period)"""
    kc = CROP_KCS.get(crop, CROP_KCS["Others"]).get(stage, 1.0)
    etc = regional_et0 * kc
    return round(etc, 2)

def compute_water_deficit(crop: str, stage: str, rainfall_mm: float, regional_et0: float) -> float:
    """Water Deficit = ETc - Rainfall (mm). Negative = surplus."""
    etc = compute_crop_water_requirement(crop, stage, regional_et0)
    deficit = etc - rainfall_mm
    return round(deficit, 2)

# ──────────────────────────────────────────
# Advisory Generator
# ──────────────────────────────────────────
def generate_advisory(
    field_id: str,
    crop: str,
    stress_label: str,
    vci: float,
    stage: str,
    rainfall_mm: float,
    regional_et0: float
) -> dict:
    """
    Generates a field-level irrigation advisory.
    """
    rule = ADVISORY_RULES.get(stress_label, ADVISORY_RULES["Healthy"])
    etc = compute_crop_water_requirement(crop, stage, regional_et0)
    deficit = compute_water_deficit(crop, stage, rainfall_mm, regional_et0)
    water_to_apply = max(0, deficit)  # Don't apply negative water

    return {
        "field_id": field_id,
        "crop": crop,
        "growth_stage": stage,
        "stress_level": stress_label,
        "vci": round(vci, 1),
        "rainfall_mm": rainfall_mm,
        "crop_water_requirement_mm": etc,
        "water_deficit_mm": deficit,
        "water_to_apply_mm": round(water_to_apply, 1),
        "urgency": rule["urgency"],
        "recommendation": f"{crop} + {stress_label} → {rule['message']}",
        "within_days": rule["within_days"],
        "priority": rule["priority"],
        "advisory_color": rule["color"],
    }


def generate_bulk_advisories(fields: list = None) -> list:
    global _rng
    if not fields:
        _rng = np.random.default_rng(42)
        # Simulate fields across all major Indian states
        STATE_CENTERS = [
            ("Punjab", 30.9, 75.8), ("UP", 26.8, 80.9), ("MP", 23.2, 77.4),
            ("Maharashtra", 19.1, 73.0), ("Karnataka", 15.3, 75.7),
            ("Tamil Nadu", 11.0, 78.0), ("West Bengal", 22.9, 88.4),
            ("Gujarat", 23.0, 72.0), ("Andhra Pradesh", 16.5, 80.6),
            ("Rajasthan", 26.9, 73.8), ("Bihar", 25.6, 85.1)
        ]
        
        fields = []
        crops = ["Rice", "Maize", "Sugarcane", "Others"]
        stages = ["Sowing", "Vegetative", "Flowering", "Maturity"]
        soils = ["Clay Loam", "Sandy Loam", "Silt", "Black Cotton"]
        
        for i in range(1, 151): # Increased to 150 fields to cover all states
            state_name, base_lat, base_lng = STATE_CENTERS[int(_rng.integers(0, len(STATE_CENTERS)))]
            fields.append({
                "field_id": f"IND-{state_name[:3].upper()}-{1000+i}",
                "crop": crops[int(_rng.integers(0, len(crops)))],
                "stage": stages[int(_rng.integers(0, len(stages)))],
                "vci": int(_rng.integers(10, 95 + 1)),
                "rainfall_mm": int(_rng.integers(0, 30 + 1)),
                "lat": base_lat + float(_rng.uniform(-1.5, 1.5)),
                "lng": base_lng + float(_rng.uniform(-1.5, 1.5)),
                "soil_type": soils[int(_rng.integers(0, len(soils)))]
            })

    PRIORITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "NONE": 4}
    advisories = []
    regional_et0 = get_regional_et0(period_days=8)
    
    for f in fields:
        stress_cat = get_stress_category(f.get('vci', 50))
        advisory = generate_advisory(
            field_id=f.get('field_id', 'UNKNOWN'),
            crop=f.get('crop', 'Rice'),
            stress_label=stress_cat['label'],
            vci=f.get('vci', 50),
            stage=f.get('stage', 'Vegetative'),
            rainfall_mm=f.get('rainfall_mm', 0),
            regional_et0=regional_et0
        )
        advisory['lat'] = f.get('lat')
        advisory['lng'] = f.get('lng')
        advisory['soil_type'] = f.get('soil_type', 'Loam')
        advisories.append(advisory)

    return sorted(advisories, key=lambda x: PRIORITY_ORDER.get(x['priority'], 5))


def get_summary_stats(advisories: list) -> dict:
    """Compute summary statistics for the dashboard home page."""
    total_fields = len(advisories)
    critical_count = sum(1 for a in advisories if a['priority'] == 'CRITICAL')
    high_count = sum(1 for a in advisories if a['priority'] == 'HIGH')
    healthy_count = sum(1 for a in advisories if a['priority'] == 'NONE')
    total_water = sum(a['water_to_apply_mm'] for a in advisories)
    avg_vci = round(sum(a['vci'] for a in advisories) / total_fields, 1) if total_fields > 0 else 0

    return {
        "total_fields": total_fields,
        "critical_alerts": critical_count,
        "high_alerts": high_count,
        "healthy_fields": healthy_count,
        "total_water_required_mm": round(total_water, 1),
        "average_vci": avg_vci,
    }


def get_command_area_advisories(advisories: list) -> list:
    """
    Groups individual field advisories into regional canal command distributaries,
    aggregating water deficits to advise canal gate operations (discharge flow status).
    """
    # Mapping field prefix to regional canal distributary names
    distributary_map = {
        "PUN": "Sutlej-Beas Canal Distributary (D-1)",
        "UP":  "Sharda Canal Distributary (D-2)",
        "MP":  "Narmada Canal MP Distributary (D-3)",
        "MAH": "Godavari Canal MH Distributary (D-4)",
        "KAR": "Krishna Canal KA Distributary (D-5)",
        "TAM": "Cauvery Canal TN Distributary (D-6)",
        "WES": "Teesta Canal WB Distributary (D-7)",
        "GUJ": "Sardar Sarovar Canal GJ Distributary (D-8)",
        "AND": "Nagarjuna Sagar Canal AP Distributary (D-9)",
        "RAJ": "Indira Gandhi Canal RJ Distributary (D-10)",
        "BIH": "Kosi Canal BH Distributary (D-11)",
    }

    groups = {}
    for a in advisories:
        # Extract prefix from field_id, e.g. "IND-PUN-1001" -> "PUN"
        parts = a["field_id"].split("-")
        prefix = parts[1] if len(parts) > 1 else "OTH"
        dist_name = distributary_map.get(prefix, "General Command Distributary (D-12)")
        
        if dist_name not in groups:
            groups[dist_name] = []
        groups[dist_name].append(a)

    summary_list = []
    for dist_name, field_list in groups.items():
        total_fields = len(field_list)
        critical_count = sum(1 for f in field_list if f["priority"] == "CRITICAL")
        high_count = sum(1 for f in field_list if f["priority"] == "HIGH")
        moderate_count = sum(1 for f in field_list if f["priority"] == "MEDIUM")
        
        total_etc = sum(f["crop_water_requirement_mm"] for f in field_list)
        total_precip = sum(f["rainfall_mm"] for f in field_list)
        total_deficit = sum(f["water_deficit_mm"] for f in field_list)
        total_water_needed = sum(f["water_to_apply_mm"] for f in field_list)
        
        avg_vci = sum(f["vci"] for f in field_list) / total_fields if total_fields > 0 else 50.0
        
        # Decide canal gate discharge strategy
        if total_deficit > (total_etc * 0.6) and (critical_count + high_count) > (total_fields * 0.4):
            gate_discharge = "MAXIMUM DISCHARGE"
            gate_color = "#dc2626"
            action_desc = "Open canal gates to maximum flow immediately. Deliver full capacity."
        elif total_deficit > (total_etc * 0.3) or (critical_count + high_count) > (total_fields * 0.2):
            gate_discharge = "MODERATE DISCHARGE"
            gate_color = "#f97316"
            action_desc = "Open gates to 50% flow. Monitor tail-end water distribution."
        elif total_deficit > 0:
            gate_discharge = "MINIMUM FLOW"
            gate_color = "#eab308"
            action_desc = "Maintain low discharge flow for critical field zones."
        else:
            gate_discharge = "CLOSED (SURPLUS)"
            gate_color = "#22c55e"
            action_desc = "Close canal gates. Sizable rainfall surplus or healthy soil moisture."

        summary_list.append({
            "command_area": dist_name,
            "total_fields_monitored": total_fields,
            "critical_fields": critical_count,
            "high_stress_fields": high_count,
            "moderate_stress_fields": moderate_count,
            "average_vci": round(avg_vci, 1),
            "total_crop_demand_mm": round(total_etc, 1),
            "total_rainfall_mm": round(total_precip, 1),
            "total_deficit_mm": round(total_deficit, 1),
            "discharge_recommendation": gate_discharge,
            "gate_action": action_desc,
            "color": gate_color,
            "water_deficit_ratio": round(total_water_needed / max(1, total_etc) * 100, 1)
        })

    # Sort so command areas with the largest total water deficit appear first.
    return sorted(summary_list, key=lambda x: x["total_deficit_mm"], reverse=True)


if __name__ == '__main__':
    # Demo: generate advisories for sample fields
    sample_fields = [
        {"field_id": "F001", "crop": "Rice",      "vci": 12, "stage": "Vegetative", "rainfall_mm": 5},
        {"field_id": "F002", "crop": "Maize",     "vci": 35, "stage": "Flowering",  "rainfall_mm": 20},
        {"field_id": "F003", "crop": "Sugarcane", "vci": 55, "stage": "Vegetative", "rainfall_mm": 30},
        {"field_id": "F004", "crop": "Rice",      "vci": 75, "stage": "Maturity",   "rainfall_mm": 50},
        {"field_id": "F005", "crop": "Others",    "vci": 90, "stage": "Sowing",     "rainfall_mm": 60},
    ]
    advisories = generate_bulk_advisories(sample_fields)
    for a in advisories:
        print(f"[{a['priority']}] {a['recommendation']} | Water: {a['water_to_apply_mm']}mm")
        
    print("\n--- Command Area Aggregation ---")
    summaries = get_command_area_advisories(advisories)
    for s in summaries:
        print(f"[{s['discharge_recommendation']}] Command: {s['command_area']} | Deficit: {s['total_deficit_mm']}mm")
