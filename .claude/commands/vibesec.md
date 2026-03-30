---
name: vibesec-skill
description: This skill helps Claude write secure web applications. Use this when working on any web application or when a user requests a scan or audit to ensure security best practices are followed.
---

# Secure Coding Guide for Web Applications

## Overview

This guide provides comprehensive secure coding practices for web applications. As an AI assistant, your role is to approach code from a **bug hunter's perspective** and make applications **as secure as possible** without breaking functionality.

**Key Principles:**
- Defense in depth: Never rely on a single security control
- Fail securely: When something fails, fail closed (deny access)
- Least privilege: Grant minimum permissions necessary
- Input validation: Never trust user input, validate everything server-side
- Output encoding: Encode data appropriately for the context it's rendered in

---

## Access Control Issues

Access control vulnerabilities occur when users can access resources or perform actions beyond their intended permissions.

### Core Requirements

For **every data point and action** that requires authentication:

1. **User-Level Authorization**
   - Each user must only access/modify their own data
   - No user should access data from other users or organizations
   - Always verify ownership at the data layer, not just the route level

2. **Use UUIDs Instead of Sequential IDs**
   - Use UUIDv4 or similar non-guessable identifiers
   - Exception: Only use sequential IDs if explicitly requested by user

3. **Account Lifecycle Handling**
   - When a user is removed from an organization: immediately revoke all access tokens and sessions
   - When an account is deleted/deactivated: invalidate all active sessions and API keys
   - Implement token revocation lists or short-lived tokens with refresh mechanisms

### Authorization Checks Checklist

- [ ] Verify user owns the resource on every request (don't trust client-side data)
- [ ] Check organization membership for multi-tenant apps
- [ ] Validate role permissions for role-based actions
- [ ] Re-validate permissions after any privilege change
- [ ] Check parent resource ownership (e.g., if accessing a comment, verify user owns the parent post)

### Common Pitfalls to Avoid

- **IDOR (Insecure Direct Object Reference)**: Always verify the requesting user has permission to access the requested resource ID
- **Privilege Escalation**: Validate role changes server-side; never trust role info from client
- **Horizontal Access**: User A accessing User B's resources with the same privilege level
- **Vertical Access**: Regular user accessing admin functionality
- **Mass Assignment**: Filter which fields users can update; don't blindly accept all request body fields

### Implementation Pattern

```
# Pseudocode for secure resource access
function getResource(resourceId, currentUser):
    resource = database.find(resourceId)

    if resource is null:
        return 404  # Don't reveal if resource exists

    if resource.ownerId != currentUser.id:
        if not currentUser.hasOrgAccess(resource.orgId):
            return 404  # Return 404, not 403, to prevent enumeration

    return resource
```

---

## Client-Side Bugs

### Cross-Site Scripting (XSS)

Every input controllable by the user—whether directly or indirectly—must be sanitized against XSS.

#### Input Sources to Protect

**Direct Inputs:**
- Form fields (email, name, bio, comments, etc.)
- Search queries
- File names during upload
- Rich text editors / WYSIWYG content

**Indirect Inputs:**
- URL parameters and query strings
- URL fragments (hash values)
- HTTP headers used in the application (Referer, User-Agent if displayed)
- Data from third-party APIs displayed to users
- WebSocket messages
- postMessage data from iframes
- LocalStorage/SessionStorage values if rendered

**Often Overlooked:**
- Error messages that reflect user input
- PDF/document generators that accept HTML
- Email templates with user data
- Log viewers in admin panels
- JSON responses rendered as HTML
- SVG file uploads (can contain JavaScript)
- Markdown rendering (if allowing HTML)

#### Protection Strategies

1. **Output Encoding** (Context-Specific)
   - HTML context: HTML entity encode (`<` -> `&lt;`)
   - JavaScript context: JavaScript escape
   - URL context: URL encode
   - CSS context: CSS escape
   - Use framework's built-in escaping (React's JSX, Vue's {{ }}, etc.)

2. **Content Security Policy (CSP)**
   ```
   Content-Security-Policy:
     default-src 'self';
     script-src 'self';
     style-src 'self' 'unsafe-inline';
     img-src 'self' data: https:;
     font-src 'self';
     connect-src 'self' https://api.yourdomain.com;
     frame-ancestors 'none';
     base-uri 'self';
     form-action 'self';
   ```
   - Avoid `'unsafe-inline'` and `'unsafe-eval'` for scripts
   - Use nonces or hashes for inline scripts when necessary
   - Report violations: `report-uri /csp-report`

3. **Input Sanitization**
   - Use established libraries (DOMPurify for HTML)
   - Whitelist allowed tags/attributes for rich text
   - Strip or encode dangerous patterns

4. **Additional Headers**
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY` (or use CSP frame-ancestors)

---

### Cross-Site Request Forgery (CSRF)

Every state-changing endpoint must be protected against CSRF attacks.

#### Endpoints Requiring CSRF Protection

**Authenticated Actions:**
- All POST, PUT, PATCH, DELETE requests
- Any GET request that changes state (fix these to use proper HTTP methods)
- File uploads
- Settings changes
- Payment/transaction endpoints

**Pre-Authentication Actions:**
- Login endpoints (prevent login CSRF)
- Signup endpoints
- Password reset request endpoints
- Password change endpoints
- Email/phone verification endpoints
- OAuth callback endpoints

#### Protection Mechanisms

1. **CSRF Tokens**
   - Generate cryptographically random tokens
   - Tie token to user session
   - Validate on every state-changing request
   - Regenerate after login (prevent session fixation combo)

2. **SameSite Cookies**
   ```
   Set-Cookie: session=abc123; SameSite=Strict; Secure; HttpOnly
   ```
   - `Strict`: Cookie never sent cross-site (best security)
   - `Lax`: Cookie sent on top-level navigations (good balance)
   - Always combine with CSRF tokens for defense in depth

3. **Double Submit Cookie Pattern**
   - Send CSRF token in both cookie and request body/header
   - Server validates they match

#### Verification Checklist

- [ ] Token is cryptographically random (use secure random generator)
- [ ] Token is tied to user session
- [ ] Token is validated server-side on all state-changing requests
- [ ] Missing token = rejected request
- [ ] Token regenerated on authentication state change
- [ ] SameSite cookie attribute is set
- [ ] Secure and HttpOnly flags on session cookies

---

### Secret Keys and Sensitive Data Exposure

No secrets or sensitive information should be accessible to client-side code.

#### Never Expose in Client-Side Code

**API Keys and Secrets:**
- Third-party API keys (Stripe, AWS, etc.)
- Database connection strings
- JWT signing secrets
- Encryption keys
- OAuth client secrets
- Internal service URLs/credentials

**Sensitive User Data:**
- Full credit card numbers
- Social Security Numbers
- Passwords (even hashed)
- Security questions/answers
- Full phone numbers (mask them: ***-***-1234)
- Sensitive PII that isn't needed for display

**Infrastructure Details:**
- Internal IP addresses
- Database schemas
- Debug information
- Stack traces in production
- Server software versions

#### Where Secrets Hide (Check These!)

- JavaScript bundles (including source maps)
- HTML comments
- Hidden form fields
- Data attributes
- LocalStorage/SessionStorage
- Initial state/hydration data in SSR apps
- Environment variables exposed via build tools (NEXT_PUBLIC_*, REACT_APP_*)

#### Best Practices

1. **Environment Variables**: Store secrets in `.env` files
2. **Server-Side Only**: Make API calls requiring secrets from backend only

---

## Open Redirect

Any endpoint accepting a URL for redirection must be protected against open redirect attacks.

### Protection Strategies

1. **Allowlist Validation**
   ```
   allowed_domains = ['yourdomain.com', 'app.yourdomain.com']

   function isValidRedirect(url):
       parsed = parseUrl(url)
       return parsed.hostname in allowed_domains
   ```

2. **Relative URLs Only**
   - Only accept paths (e.g., `/dashboard`) not full URLs
   - Validate the path starts with `/` and doesn't contain `//`

3. **Indirect References**
   - Use a mapping instead of raw URLs: `?redirect=dashboard` -> lookup to `/dashboard`

---

### Password Security

#### Password Requirements

- Minimum 8 characters (12+ recommended)
- No maximum length (or very high, e.g., 128 chars)
- Allow all characters including special chars
- Don't require specific character types (let users choose strong passwords)

#### Storage

- Use Argon2id, bcrypt, or scrypt
- Never MD5, SHA1, or plain SHA256

---

## Server-Side Bugs

### SQL Injection

#### Prevention Methods

**1. Parameterized Queries (Prepared Statements)** -- PRIMARY DEFENSE
```sql
-- VULNERABLE
query = "SELECT * FROM users WHERE id = " + userId

-- SECURE
query = "SELECT * FROM users WHERE id = ?"
execute(query, [userId])
```

**2. ORM Usage**
- Use ORM methods that automatically parameterize
- Be cautious with raw query methods in ORMs
- Watch for ORM-specific injection points

**3. Input Validation**
- Validate data types (integer should be integer)
- Whitelist allowed values where applicable
- This is defense-in-depth, not primary defense

---

## Security Headers Checklist

Include these headers in all responses:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: [see XSS section]
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Cache-Control: no-store (for sensitive pages)
```

---

## JWT Security

### Secure Implementation

- Always use environment variables for secrets
- Use short-lived tokens (15 min)
- Include unique `jti` claim for revocation
- Store in httpOnly, Secure, SameSite=Strict cookies (never localStorage)
- Whitelist the allowed algorithm on verification
- Reject `alg: none`
- Use 256+ bits of random data for secrets
- Implement refresh token rotation

---

## API Security

### Mass Assignment

```javascript
// VULNERABLE
User.update(req.body)

// SECURE
const allowed = ['name', 'email', 'avatar']
const updates = pick(req.body, allowed)
User.update(updates)
```

Always explicitly define which fields a request can modify.

---

## General Security Principles

When generating code, always:

1. **Validate all input server-side** -- Never trust client-side validation alone
2. **Use parameterized queries** -- Never concatenate user input into queries
3. **Encode output contextually** -- HTML, JS, URL, CSS contexts need different encoding
4. **Apply authentication checks** -- On every endpoint, not just at routing
5. **Apply authorization checks** -- Verify the user can access the specific resource
6. **Use secure defaults**
7. **Handle errors securely** -- Don't leak stack traces or internal details to users
8. **Keep dependencies updated** -- Use tools to track vulnerable dependencies

When unsure, choose the more restrictive/secure option and document the security consideration in comments.
