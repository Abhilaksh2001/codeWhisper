-- Query 1: List all devices enrolled by admin user with app usage of at least 2 hours/day from Jan 1, 2025 to Mar 1, 2025
-- Note: This query assumes we have an app_usage table that tracks application usage time

-- First, we need to add an app_usage table to track usage time (not in original schema)
CREATE TABLE IF NOT EXISTS app_usage (
    usage_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL,
    app_id INT NOT NULL,
    usage_date DATE NOT NULL,
    usage_duration_minutes INT NOT NULL,
    FOREIGN KEY (device_id) REFERENCES devices(device_id),
    FOREIGN KEY (app_id) REFERENCES applications(app_id)
);

-- Query to find devices enrolled by admin with at least 2 hours usage per day
SELECT DISTINCT d.device_id, d.device_name, d.model, d.manufacturer
FROM devices d
JOIN audit_logs al ON d.device_id = al.entity_id AND al.entity_type = 'device' AND al.action = 'create'
JOIN users u ON al.user_id = u.user_id
JOIN (
    SELECT au.device_id
    FROM app_usage au
    WHERE au.usage_date BETWEEN '2025-01-01' AND '2025-03-01'
    GROUP BY au.device_id, au.usage_date
    HAVING SUM(au.usage_duration_minutes) >= 120 -- 2 hours = 120 minutes
) usage_data ON d.device_id = usage_data.device_id
WHERE u.username = 'admin';

-- Query 2: List all apps that are installed on devices but not used
-- Note: This query assumes we have app_usage data to determine usage

SELECT a.app_id, a.app_name, a.package_name, d.device_id, d.device_name
FROM applications a
JOIN device_applications da ON a.app_id = da.app_id
JOIN devices d ON da.device_id = d.device_id
LEFT JOIN app_usage au ON a.app_id = au.app_id AND d.device_id = au.device_id
WHERE da.status = 'installed'
  AND au.usage_id IS NULL;

-- Query 3: For each device, find the second most used app for the month of April
-- Note: This query uses window functions to rank apps by usage time

WITH april_usage AS (
    SELECT 
        au.device_id,
        au.app_id,
        SUM(au.usage_duration_minutes) AS total_usage,
        RANK() OVER (PARTITION BY au.device_id ORDER BY SUM(au.usage_duration_minutes) DESC) AS usage_rank
    FROM app_usage au
    WHERE EXTRACT(MONTH FROM au.usage_date) = 4 -- April
    GROUP BY au.device_id, au.app_id
)

SELECT 
    d.device_id,
    d.device_name,
    a.app_id,
    a.app_name,
    a.package_name,
    au.total_usage AS april_usage_minutes
FROM april_usage au
JOIN devices d ON au.device_id = d.device_id
JOIN applications a ON au.app_id = a.app_id
WHERE au.usage_rank = 2;