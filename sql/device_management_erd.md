# Android Device Management Solution - Entity Relationship Diagram

```
+----------------+       +---------------+       +----------------+
|     USERS      |       |     ROLES     |       |  USER_GROUPS   |
+----------------+       +---------------+       +----------------+
| PK user_id     |<----->| PK role_id    |       | PK group_id    |
|    username    |       |    role_name  |       |    group_name  |
|    password    |       |    description|       |    description |
|    email       |       +---------------+       +----------------+
|    first_name  |                                       ^
|    last_name   |                                       |
|    created_at  |                                       |
|    updated_at  |                                       |
|    is_active   |<--------------------------------------+
+----------------+
        ^
        |
        v
+----------------+       +----------------+       +----------------+
|    DEVICES     |       | DEVICE_GROUPS  |       |      TAGS      |
+----------------+       +----------------+       +----------------+
| PK device_id   |<----->| PK group_id    |       | PK tag_id      |
|    device_uuid |       |    group_name  |       |    tag_name    |
|    device_name |       |    description |       |    description |
|    model       |       +----------------+       +----------------+
|    manufacturer|                                       ^
|    os_version  |                                       |
|    serial_num  |                                       |
|    imei        |                                       |
|    mac_address |                                       |
|    last_online |                                       |
|    status      |<--------------------------------------+
|    enrollment  |
+----------------+
        ^
        |
        v
+----------------+       +----------------+       +----------------+
| COMMAND_TYPES  |       |DEVICE_COMMANDS |       | GROUP_COMMANDS |
+----------------+       +----------------+       +----------------+
| PK cmd_type_id |<----->| PK command_id  |<----->| PK grp_cmd_id  |
|    cmd_name    |       |    device_id   |       |    group_id    |
|    description |       |    cmd_type_id |       |    cmd_type_id |
|    params      |       |    parameters  |       |    parameters  |
+----------------+       |    status      |       |    status      |
                         |    result      |       |    created_by  |
                         |    created_by  |       +----------------+
                         |    created_at  |
                         +----------------+
                                 ^
                                 |
                                 v
+----------------+       +----------------+       +----------------+
|  APPLICATIONS  |       |DEVICE_APPS     |       |  APP_COMMANDS  |
+----------------+       +----------------+       +----------------+
| PK app_id      |<----->| PK device_id   |<----->| PK app_cmd_id  |
|    package_name|       | PK app_id      |       |    device_id   |
|    app_name    |       |    install_date|       |    app_id      |
|    version     |       |    version     |       |    cmd_type    |
|    description |       |    status      |       |    status      |
|    app_url     |       +----------------+       |    created_by  |
|    is_system   |                                |    result      |
+----------------+                                +----------------+
```

## Key Relationships:

1. **Users & Roles**: Many-to-many relationship (users can have multiple roles)
2. **Users & User Groups**: Many-to-many relationship (users can belong to multiple groups)
3. **Devices & Device Groups**: Many-to-many relationship (devices can belong to multiple groups)
4. **Devices & Tags**: Many-to-many relationship (devices can have multiple tags)
5. **Devices & Commands**: One-to-many relationship (devices can have multiple commands)
6. **Command Types & Device Commands**: One-to-many relationship (command types can be used in multiple commands)
7. **Device Groups & Group Commands**: One-to-many relationship (commands can be sent to groups)
8. **Group Commands & Device Commands**: One-to-many relationship (group commands generate individual device commands)
9. **Devices & Applications**: Many-to-many relationship (devices can have multiple apps installed)
10. **Applications & App Commands**: One-to-many relationship (app commands reference specific applications)

## Additional Tables (Not shown in diagram):

1. **user_roles**: Junction table for users and roles
2. **user_group_members**: Junction table for users and user groups
3. **device_group_members**: Junction table for devices and device groups
4. **device_tags**: Junction table for devices and tags
5. **device_command_relationship**: Links group commands to individual device commands
6. **device_ownership**: Tracks which user is assigned to which device
7. **audit_logs**: Records all system actions for auditing purposes