# Updated User Credentials

After removing the SUPER_ADMIN role, the system now uses a simplified role system with only two roles: **USER** and **ADMIN**.

## Available Roles

- **USER**: Regular user with basic access
- **ADMIN**: Administrator with full access to user management and all system features

## Default Login Credentials

### Admin Account
- **Username**: `admin`
- **Password**: `SecurePass123!`
- **Email**: `admin@vehiclemanagement.com`
- **Role**: `ADMIN`
- **Access**: Full access to all features including user management

### Regular User Account
- **Username**: `user`
- **Password**: `UserPass123!`
- **Email**: `user@vehiclemanagement.com`
- **Role**: `USER`
- **Access**: Basic features, cannot access user management

## Important Notes

1. **User Management Access**: Only users with `ADMIN` role can access the user management features at `/users`
2. **Database Migration**: The system automatically converts any existing `SUPER_ADMIN` users to `ADMIN` role
3. **Security**: All admin endpoints (`/api/admin/**`) require `ADMIN` role
4. **Login URL**: Use these credentials at `http://localhost:3000/login`

## Troubleshooting

If you're getting "Access Denied" errors:
1. Make sure you're logged in with the **admin** account (`admin` / `SecurePass123!`)
2. Verify your user role in the browser's developer tools (check JWT token payload)
3. Clear browser cache and cookies if needed

## Role Permissions

| Feature | USER | ADMIN |
|---------|------|-------|
| Login/Logout | ✅ | ✅ |
| View Dashboard | ✅ | ✅ |
| Manage Employees | ✅ | ✅ |
| Manage Vehicles | ✅ | ✅ |
| Manage Departments | ✅ | ✅ |
| **Manage Users** | ❌ | ✅ |
| **Bulk Operations** | ❌ | ✅ |
| **System Administration** | ❌ | ✅ |
