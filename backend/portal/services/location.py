import math

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    """
    Calculates the great-circle distance between two geographic coordinates on Earth in meters.
    Uses pure Python math functions with spherical earth model (R = 6,371,000 m).
    """
    R = 6371000.0  # Earth radius in meters

    phi1 = math.radians(float(lat1))
    phi2 = math.radians(float(lat2))
    delta_phi = math.radians(float(lat2) - float(lat1))
    delta_lambda = math.radians(float(lon2) - float(lon1))

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return int(round(R * c))
