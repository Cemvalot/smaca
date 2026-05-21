-- Run on VM once: disables slow readings fallback on /api/sensors when tvoc/light
-- exist on sensor_latest (values can be backfilled later via rebuild).
ALTER TABLE sensor_latest
  ADD COLUMN tvoc_index DECIMAL(10,2) NULL AFTER humidity_rh,
  ADD COLUMN light_level DECIMAL(12,2) NULL AFTER pm10_ugm3;
