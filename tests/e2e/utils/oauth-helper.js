import jwt from "jsonwebtoken";

export class OAuthHelper {
  constructor() {
    // Mock JWT signing secret for testing
    this.testSecret = "test-oauth-secret-for-jwt-signing";
    this.auth0Domain = process.env.AUTH0_DOMAIN || "dev-ar3xnr65khxqdivp.us.auth0.com";
  }

  /**
   * Generate a mock JWT token for testing
   * @param {Object} userInfo - User information
   * @param {string} userInfo.sub - Auth0 user ID
   * @param {string} userInfo.email - User email
   * @param {string} userInfo.nickname - User nickname/username
   * @param {Object} options - Token options
   * @param {string} options.expiresIn - Token expiration (default: 1h)
   * @returns {string} JWT token
   */
  generateMockToken(userInfo, options = {}) {
    const { sub, email, nickname } = userInfo;
    const { expiresIn = "1h" } = options;

    const payload = {
      sub,
      email,
      nickname,
      email_verified: true,
      iss: `https://${this.auth0Domain}/`,
      aud: process.env.AUTH0_CLIENT_ID,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (expiresIn === "1h" ? 3600 : parseInt(expiresIn))
    };

    return jwt.sign(payload, this.testSecret, { algorithm: "HS256" });
  }

  /**
   * Generate tokens for all test users
   * @returns {Object} Object containing tokens for each test user
   */
  generateTestTokens() {
    const testUsers = [
      {
        sub: process.env.TEST_USER_1_AUTH0_ID,
        email: process.env.TEST_USER_1_EMAIL,
        nickname: process.env.TEST_USER_1_USERNAME
      },
      {
        sub: process.env.TEST_USER_2_AUTH0_ID,
        email: process.env.TEST_USER_2_EMAIL,
        nickname: process.env.TEST_USER_2_USERNAME
      },
      {
        sub: process.env.TEST_USER_3_AUTH0_ID,
        email: process.env.TEST_USER_3_EMAIL,
        nickname: process.env.TEST_USER_3_USERNAME
      }
    ];

    return {
      user1: this.generateMockToken(testUsers[0]),
      user2: this.generateMockToken(testUsers[1]),
      user3: this.generateMockToken(testUsers[2])
    };
  }

  /**
   * Generate an expired token for testing
   * @param {Object} userInfo - User information
   * @returns {string} Expired JWT token
   */
  generateExpiredToken(userInfo) {
    return this.generateMockToken(userInfo, { expiresIn: "-1h" });
  }

  /**
   * Generate a malformed token for testing
   * @returns {string} Malformed token
   */
  generateMalformedToken() {
    return "malformed.jwt.token";
  }

  /**
   * Mock the Auth0 userinfo endpoint response
   * @param {string} token - JWT token
   * @returns {Object} Mock userinfo response
   */
  mockUserinfoResponse(token) {
    try {
      const decoded = jwt.verify(token, this.testSecret);
      return {
        sub: decoded.sub,
        email: decoded.email,
        nickname: decoded.nickname,
        email_verified: decoded.email_verified
      };
    } catch (error) {
      throw new Error(`Invalid token: ${error.message}`);
    }
  }
}

export default new OAuthHelper();
