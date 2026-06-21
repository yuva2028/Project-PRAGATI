"""
Irrigation Advisory Engine
Rule-Based System + Water Deficit Estimation
Generates field-level irrigation advisories
"""

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
    except Exception:
        pass
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
    if not fields:
        import random
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
            state_name, base_lat, base_lng = random.choice(STATE_CENTERS)
            fields.append({
                "field_id": f"IND-{state_name[:3].upper()}-{1000+i}",
                "crop": random.choice(crops),
                "stage": random.choice(stages),
                "vci": random.randint(10, 95),
                "rainfall_mm": random.randint(0, 30),
                "lat": base_lat + random.uniform(-1.5, 1.5),
                "lng": base_lng + random.uniform(-1.5, 1.5),
                "soil_type": random.choice(soils)
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
