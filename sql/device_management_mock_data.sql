-- Mock Data for Android Device Management Solution

-- Roles
INSERT INTO roles (role_name, description) VALUES
('admin', 'Full system access'),
('manager', 'Can manage devices and users'),
('user', 'Regular user with limited access'),
('support', 'Technical support staff');

-- Users
INSERT INTO users (username, password_hash, email, first_name, last_name, is_active) VALUES
('admin', '$2a$12$1InE3Uqh0FQQdviK/4LNT.CxEEUP4hCM1DCH8LrwHXxM0JCYgyUJG', 'admin@example.com', 'Admin', 'User', true),
('jsmith', '$2a$12$ZE8aVza.BQEmIlk9o6TfbOcBB9kPvHqUMfZCIHT2TiKsUjQ5pQYZi', 'john.smith@example.com', 'John', 'Smith', true),
('mjones', '$2a$12$kH.V5.r9TRmG9hPFyKF2WOQfuZ1wdUlCOoaJmMOQlQ5vOFfcg.adW', 'mary.jones@example.com', 'Mary', 'Jones', true),
('rjohnson', '$2a$12$kH.V5.r9TRmG9hPFyKF2WOQfuZ1wdUlCOoaJmMOQlQ5vOFfcg.adW', 'robert.johnson@example.com', 'Robert', 'Johnson', true),
('agarcia', '$2a$12$kH.V5.r9TRmG9hPFyKF2WOQfuZ1wdUlCOoaJmMOQlQ5vOFfcg.adW', 'anna.garcia@example.com', 'Anna', 'Garcia', true);

-- User Roles
INSERT INTO user_roles (user_id, role_id) VALUES
(1, 1), -- admin has admin role
(2, 2), -- jsmith has manager role
(3, 3), -- mjones has user role
(4, 3), -- rjohnson has user role
(4, 4), -- rjohnson also has support role
(5, 2); -- agarcia has manager role

-- User Groups
INSERT INTO user_groups (group_name, description) VALUES
('IT Department', 'Information Technology staff'),
('Sales Team', 'Sales department users'),
('Field Staff', 'Users working in the field');

-- User Group Members
INSERT INTO user_group_members (user_id, group_id) VALUES
(1, 1), -- admin in IT Department
(2, 1), -- jsmith in IT Department
(3, 2), -- mjones in Sales Team
(4, 3), -- rjohnson in Field Staff
(5, 2); -- agarcia in Sales Team

-- Devices
INSERT INTO devices (device_uuid, device_name, model, manufacturer, os_version, serial_number, imei, mac_address, last_online, status) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'SM-G973F-001', 'Galaxy S10', 'Samsung', 'Android 12', 'SN123456789', '123456789012345', 'AA:BB:CC:DD:EE:FF', NOW() - INTERVAL '5 minutes', 'active'),
('550e8400-e29b-41d4-a716-446655440001', 'SM-G973F-002', 'Galaxy S10', 'Samsung', 'Android 11', 'SN123456790', '123456789012346', 'AA:BB:CC:DD:EE:00', NOW() - INTERVAL '2 hours', 'active'),
('550e8400-e29b-41d4-a716-446655440002', 'Pixel-6-001', 'Pixel 6', 'Google', 'Android 13', 'SN987654321', '987654321098765', 'BB:CC:DD:EE:FF:00', NOW() - INTERVAL '1 day', 'inactive'),
('550e8400-e29b-41d4-a716-446655440003', 'OnePlus9-001', 'OnePlus 9', 'OnePlus', 'Android 12', 'SN567891234', '567891234567890', 'CC:DD:EE:FF:00:11', NOW() - INTERVAL '15 minutes', 'active'),
('550e8400-e29b-41d4-a716-446655440004', 'Xperia-1-001', 'Xperia 1 III', 'Sony', 'Android 12', 'SN112233445', '112233445566778', 'DD:EE:FF:00:11:22', NOW() - INTERVAL '3 days', 'lost');

-- Device Groups
INSERT INTO device_groups (group_name, description) VALUES
('Sales Devices', 'Devices assigned to sales team'),
('Field Devices', 'Devices used in the field'),
('Test Devices', 'Devices used for testing');

-- Device Group Members
INSERT INTO device_group_members (device_id, group_id) VALUES
(1, 1), -- Samsung Galaxy S10 in Sales Devices
(2, 1), -- Samsung Galaxy S10 in Sales Devices
(3, 3), -- Pixel 6 in Test Devices
(4, 2), -- OnePlus 9 in Field Devices
(5, 3); -- Sony Xperia in Test Devices

-- Tags
INSERT INTO tags (tag_name, description) VALUES
('high-security', 'Devices with enhanced security requirements'),
('camera-enabled', 'Devices with camera functionality enabled'),
('gps-tracking', 'Devices with GPS tracking enabled'),
('corporate', 'Corporate-owned devices'),
('byod', 'Bring your own device');

-- Device Tags
INSERT INTO device_tags (device_id, tag_id) VALUES
(1, 1), -- Samsung Galaxy S10 has high-security
(1, 3), -- Samsung Galaxy S10 has gps-tracking
(1, 4), -- Samsung Galaxy S10 is corporate
(2, 2), -- Samsung Galaxy S10 has camera-enabled
(2, 4), -- Samsung Galaxy S10 is corporate
(3, 2), -- Pixel 6 has camera-enabled
(3, 3), -- Pixel 6 has gps-tracking
(4, 3), -- OnePlus 9 has gps-tracking
(4, 5), -- OnePlus 9 is byod
(5, 1); -- Sony Xperia has high-security

-- Command Types
INSERT INTO command_types (command_name, description, parameters_schema) VALUES
('lock_device', 'Remotely lock the device', '{"type": "object", "properties": {"message": {"type": "string"}}}'),
('wipe_device', 'Factory reset the device', '{"type": "object", "properties": {"wipe_external_storage": {"type": "boolean"}}}'),
('update_settings', 'Update device settings', '{"type": "object", "properties": {"settings": {"type": "object"}}}'),
('get_location', 'Get device location', '{"type": "object", "properties": {"accuracy": {"type": "string", "enum": ["high", "medium", "low"]}}}'),
('reboot_device', 'Reboot the device', '{"type": "object", "properties": {}}');

-- Device Commands
INSERT INTO device_commands (device_id, command_type_id, parameters, status, result, created_by) VALUES
(1, 1, '{"message": "Device locked for security reasons"}', 'completed', 'Device locked successfully', 1),
(2, 4, '{"accuracy": "high"}', 'completed', '{"latitude": 37.7749, "longitude": -122.4194, "accuracy": 10}', 2),
(3, 5, '{}', 'failed', 'Device offline', 1),
(4, 3, '{"settings": {"bluetooth": false, "wifi": true}}', 'sent', NULL, 2),
(5, 2, '{"wipe_external_storage": true}', 'pending', NULL, 1);

-- Group Commands
INSERT INTO group_commands (group_id, command_type_id, parameters, status, created_by) VALUES
(1, 3, '{"settings": {"data_roaming": false}}', 'completed', 1),
(2, 4, '{"accuracy": "medium"}', 'in_progress', 2);

-- Device Command Relationship
INSERT INTO device_command_relationship (group_command_id, device_command_id) VALUES
(1, 4);

-- Applications
INSERT INTO applications (package_name, app_name, version, description, app_url, is_system_app) VALUES
('com.google.android.gms', 'Google Play Services', '23.15.16', 'Google Play Services for Android', 'https://play.google.com/store/apps/details?id=com.google.android.gms', true),
('com.example.crm', 'Sales CRM', '2.1.0', 'Customer Relationship Management app', 'https://example.com/apps/crm.apk', false),
('com.example.inventory', 'Inventory Manager', '1.5.2', 'Inventory tracking application', 'https://example.com/apps/inventory.apk', false),
('com.example.scanner', 'Barcode Scanner', '3.0.1', 'Barcode and QR code scanner', 'https://example.com/apps/scanner.apk', false),
('com.example.security', 'Security Suite', '2.2.0', 'Enterprise security application', 'https://example.com/apps/security.apk', false);

-- Device Applications
INSERT INTO device_applications (device_id, app_id, version_installed, status) VALUES
(1, 1, '23.15.16', 'installed'),
(1, 2, '2.1.0', 'installed'),
(1, 5, '2.2.0', 'installed'),
(2, 1, '23.15.16', 'installed'),
(2, 2, '2.1.0', 'installed'),
(2, 3, '1.5.2', 'installed'),
(3, 1, '23.15.16', 'installed'),
(3, 4, '3.0.1', 'installed'),
(4, 1, '23.15.16', 'installed'),
(4, 3, '1.5.1', 'installed'),
(4, 4, '3.0.1', 'pending_install'),
(5, 1, '23.15.16', 'installed'),
(5, 5, '2.1.9', 'pending_uninstall');

-- App Commands
INSERT INTO app_commands (device_id, app_id, command_type, status, created_by, result) VALUES
(4, 4, 'install', 'pending', 2, NULL),
(5, 5, 'uninstall', 'pending', 1, NULL),
(3, 3, 'install', 'failed', 2, 'Insufficient storage space'),
(2, 4, 'install', 'completed', 1, 'Successfully installed'),
(1, 3, 'uninstall', 'completed', 1, 'Successfully uninstalled');

-- Device Ownership
INSERT INTO device_ownership (device_id, assigned_user_id, notes) VALUES
(1, 3, 'Primary device for sales team member'),
(2, 5, 'Secondary device for manager'),
(4, 4, 'Field technician device');

-- Audit Logs
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES
(1, 'create', 'device', 1, '{"action": "enrolled_device"}', '192.168.1.100'),
(1, 'update', 'device', 2, '{"status": {"from": "inactive", "to": "active"}}', '192.168.1.100'),
(2, 'create', 'command', 1, '{"command_type": "lock_device"}', '192.168.1.101'),
(1, 'create', 'app_command', 1, '{"command_type": "install", "app_id": 4}', '192.168.1.100'),
(5, 'update', 'user', 4, '{"role": {"added": "support"}}', '192.168.1.105');