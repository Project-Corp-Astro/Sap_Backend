# Authentication Service Documentation

## Overview
This document outlines the authentication processes in the SAP Corp Astro authentication service, including user registration and password recovery. The system provides secure ways for users to create accounts and manage credentials while implementing validation, security best practices, and role-based access control.

## API Endpoint

**Endpoint:** `POST /api/auth/register`  
**Access:** Public  
**Description:** Register a new user in the system

## Request Format

### Headers
- `Content-Type: application/json`

### Body Parameters
| Parameter  | Type   | Required | Description                        | Validation                     |
|------------|--------|----------|------------------------------------|--------------------------------|
| username   | string | Yes      | Unique username for identification | Min 3 characters               |
| email      | string | Yes      | User's email address               | Valid email format             |
| password   | string | Yes      | User's password                    | Min 8 characters               |
| firstName  | string | Yes      | User's first name                  | Non-empty                      |
| lastName   | string | Yes      | User's last name                   | Non-empty                      |
| role       | string | No       | User role (admin only)             | Only applied if admin requests |

### Example Request
```json
{
  "username": "johndoe",
  "email": "john.doe@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

## Response Format

### Success Response (201 Created)
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "_id": "60d21b4667d0d8992e610c85",
    "username": "johndoe",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "isActive": true,
    "createdAt": "2025-06-12T04:56:22.343Z",
    "updatedAt": "2025-06-12T04:56:22.343Z"
  }
}
```

### Error Responses

#### Validation Error (400 Bad Request)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Please provide a valid email"
    }
  ]
}
```

#### Missing Fields Error (400 Bad Request)
```json
{
  "success": false,
  "message": "All fields are required"
}
```

#### Conflict Error (409 Conflict)
```json
{
  "success": false,
  "message": "Email already in use"
}
```

or

```json
{
  "success": false,
  "message": "Username already taken"
}
```

#### Server Error (500 Internal Server Error)
```json
{
  "success": false,
  "message": "An unexpected error occurred"
}
```

## Registration Flow

1. **Request Validation**
   - The request is validated using the validation middleware
   - Checks for valid email format, minimum password length, username length, and required fields

2. **Controller Processing**
   - Extracts user data from request body
   - Verifies all required fields are present
   - Handles role assignment (only if requested by an admin)

3. **Service Layer Processing**
   - Checks for existing users with the same email or username
   - Creates a new user record if no conflicts exist
   - Hashes the password securely (using bcrypt)
   - Sets default values (role="user", isActive=true)

4. **Email Notification**
   - Sends a welcome email to the newly registered user
   - Email sending is non-blocking (registration succeeds even if email fails)

5. **Response**
   - Returns user data with password removed
   - Includes a success message and status code

## Security Considerations

1. **Password Security**
   - Passwords are never stored in plain text
   - Password hashing uses bcrypt with appropriate salt rounds
   - Password is excluded from API responses

2. **Role-Based Access Control**
   - Regular users cannot set their own role during registration
   - Only administrators can set user roles

3. **Input Validation**
   - Strict validation on all input fields
   - Minimum length requirements for usernames and passwords
   - Email validation to ensure proper format

4. **Duplicate Prevention**
   - System prevents duplicate usernames and emails
   - Provides clear error messages for conflicts

## Password Recovery Flow

The authentication service implements a secure password recovery process using OTP (One-Time Password) validation.

### API Endpoints

#### 1. Request Password Reset OTP

**Endpoint:** `POST /api/auth/password-reset/request`  
**Access:** Public  
**Description:** Request an OTP for password reset

##### Request Format
```json
{
  "email": "john.doe@example.com"
}
```

##### Success Response (200 OK)
```json
{
  "success": true,
  "message": "OTP has been sent to your email",
  "data": {
    "expiresIn": 90
  }
}
```

##### Error Response (404 Not Found)
```json
{
  "success": false,
  "message": "User does not exist"
}
```

#### 2. Verify Password Reset OTP

**Endpoint:** `POST /api/auth/password-reset/verify-otp`  
**Access:** Public  
**Description:** Verify the OTP sent to user's email

##### Request Format
```json
{
  "email": "john.doe@example.com",
  "otp": "1234"
}
```

##### Success Response (200 OK)
```json
{
  "success": true,
  "message": "OTP verified successfully"
}
```

##### Error Response (400 Bad Request)
```json
{
  "success": false,
  "message": "Invalid OTP"
}
```

#### 3. Reset Password with Verified OTP

**Endpoint:** `POST /api/auth/password-reset/change`  
**Access:** Public  
**Description:** Set a new password after OTP verification

##### Request Format
```json
{
  "email": "john.doe@example.com",
  "newPassword": "newSecurePassword123"
}
```

##### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Password has been reset successfully"
}
```

##### Error Response (400 Bad Request)
```json
{
  "success": false,
  "message": "OTP has expired or is invalid"
}
```

### Password Reset Flow

1. **OTP Request**
   - User requests password reset by providing their email
   - System verifies the email exists in the database
   - System generates a numeric OTP (4 digits)
   - OTP is sent to the user's email address
   - OTP is stored in Redis with an expiration time (90 seconds)

2. **OTP Verification**
   - User submits the OTP they received
   - System validates the OTP against the stored value
   - If valid, system marks the OTP as verified for the next step

3. **Password Reset**
   - User submits a new password
   - System validates that the OTP was previously verified
   - Password is securely hashed
   - User's password is updated in the database

4. **Security Considerations**
   - OTP has a short expiration time (90 seconds)
   - OTP is stored securely in Redis with TTL
   - OTP is invalidated after successful password reset
   - Password strength validation is applied to new password
   - Multiple failed attempts are logged
```
