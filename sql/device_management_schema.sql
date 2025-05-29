-- Database Schema for Android Device Management Solution (PostgreSQL)

-- Create custom types for status fields
CREATE TYPE device_status AS ENUM ('active', 'inactive', 'lost', 'decommissioned');
CREATE TYPE command_status AS ENUM ('pending', 'sent', 'received', 'executing', 'completed', 'failed');
CREATE TYPE group_command_status AS ENUM ('pending', 'in_progress', 'completed', 'failed');
CREATE TYPE app_command_type AS ENUM ('install', 'uninstall', 'update');
CREATE TYPE app_status AS ENUM ('installed', 'pending_install', 'pending_uninstall', 'failed');

-- Users Table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Roles Table
CREATE TABLE roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255)
);

-- User Roles (Many-to-Many relationship between Users and Roles)
CREATE TABLE user_roles (
    user_id INT,
    role_id INT,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE
);

-- User Groups
CREATE TABLE user_groups (
    group_id SERIAL PRIMARY KEY,
    group_name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Group Membership (Many-to-Many relationship between Users and User Groups)
CREATE TABLE user_group_members (
    user_id INT,
    group_id INT,
    PRIMARY KEY (user_id, group_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES user_groups(group_id) ON DELETE CASCADE
);

-- Devices Table
CREATE TABLE devices (
    device_id SERIAL PRIMARY KEY,
    device_uuid VARCHAR(100) NOT NULL UNIQUE,
    device_name VARCHAR(100),
    model VARCHAR(100),
    manufacturer VARCHAR(100),
    os_version VARCHAR(50),
    serial_number VARCHAR(100),
    imei VARCHAR(50),
    mac_address VARCHAR(50),
    last_online TIMESTAMP,
    status device_status DEFAULT 'active',
    enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Device Groups
CREATE TABLE device_groups (
    group_id SERIAL PRIMARY KEY,
    group_name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Device Group Membership (Many-to-Many relationship between Devices and Device Groups)
CREATE TABLE device_group_members (
    device_id INT,
    group_id INT,
    PRIMARY KEY (device_id, group_id),
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES device_groups(group_id) ON DELETE CASCADE
);

-- Tags Table
CREATE TABLE tags (
    tag_id SERIAL PRIMARY KEY,
    tag_name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255)
);

-- Device Tags (Many-to-Many relationship between Devices and Tags)
CREATE TABLE device_tags (
    device_id INT,
    tag_id INT,
    PRIMARY KEY (device_id, tag_id),
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(tag_id) ON DELETE CASCADE
);

-- Command Types
CREATE TABLE command_types (
    command_type_id SERIAL PRIMARY KEY,
    command_name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    parameters_schema JSONB -- JSONB schema for command parameters
);

-- Device Commands
CREATE TABLE device_commands (
    command_id SERIAL PRIMARY KEY,
    device_id INT,
    command_type_id INT,
    parameters JSONB, -- Actual parameters for the command
    status command_status DEFAULT 'pending',
    result TEXT, -- Result or error message
    created_by INT, -- User who created the command
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    FOREIGN KEY (command_type_id) REFERENCES command_types(command_type_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

-- Group Commands (Commands sent to a group of devices)
CREATE TABLE group_commands (
    group_command_id SERIAL PRIMARY KEY,
    group_id INT,
    command_type_id INT,
    parameters JSONB,
    status group_command_status DEFAULT 'pending',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES device_groups(group_id),
    FOREIGN KEY (command_type_id) REFERENCES command_types(command_type_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

-- Device Command Relationship (Links group commands to individual device commands)
CREATE TABLE device_command_relationship (
    group_command_id INT,
    device_command_id INT,
    PRIMARY KEY (group_command_id, device_command_id),
    FOREIGN KEY (group_command_id) REFERENCES group_commands(group_command_id) ON DELETE CASCADE,
    FOREIGN KEY (device_command_id) REFERENCES device_commands(command_id) ON DELETE CASCADE
);

-- Applications Table
CREATE TABLE applications (
    app_id SERIAL PRIMARY KEY,
    package_name VARCHAR(255) NOT NULL UNIQUE,
    app_name VARCHAR(100),
    version VARCHAR(50),
    description TEXT,
    app_url VARCHAR(255), -- URL to download the app
    is_system_app BOOLEAN DEFAULT FALSE
);

-- Device Applications (Many-to-Many relationship between Devices and Applications)
CREATE TABLE device_applications (
    device_id INT,
    app_id INT,
    installation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version_installed VARCHAR(50),
    status app_status DEFAULT 'installed',
    PRIMARY KEY (device_id, app_id),
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    FOREIGN KEY (app_id) REFERENCES applications(app_id) ON DELETE CASCADE
);

-- App Installation Commands
CREATE TABLE app_commands (
    app_command_id SERIAL PRIMARY KEY,
    device_id INT,
    app_id INT,
    command_type app_command_type NOT NULL,
    status command_status DEFAULT 'pending',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    result TEXT,
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    FOREIGN KEY (app_id) REFERENCES applications(app_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

-- Device Ownership
CREATE TABLE device_ownership (
    device_id INT PRIMARY KEY,
    assigned_user_id INT,
    assignment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Audit Log
CREATE TABLE audit_logs (
    log_id SERIAL PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- e.g., 'device', 'user', 'command'
    entity_id INT,
    details JSONB,
    ip_address VARCHAR(45),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_timestamp BEFORE UPDATE
ON users FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_device_commands_timestamp BEFORE UPDATE
ON device_commands FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_group_commands_timestamp BEFORE UPDATE
ON group_commands FOR EACH ROW EXECUTE PROCEDURE update_timestamp();