# Risk Warnings

> **IMPORTANT: Read this document before using SocialCommander in production.**

## Platform Terms of Service

### X (Twitter / X Corp)

X's [Terms of Service](https://twitter.com/en/tos) and [Developer Agreement](https://developer.twitter.com/en/developer-terms/agreement-and-policy) **prohibit**:

- Automated posting without user initiation (beyond Twitter's approved automation tools)
- Operating multiple accounts for coordinated inauthentic behavior
- Using scrapers or automation to simulate user actions
- Circumventing rate limits

**Risk:** Account suspension, IP ban, legal action from X Corp.

### Reddit

Reddit's [User Agreement](https://www.redditinc.com/policies/user-agreement) and [API Terms](https://www.reddit.com/wiki/api-terms/) **prohibit**:

- Automated voting, posting, or commenting at scale
- Creating or operating multiple accounts for coordinated actions
- Using automated tools to interact with Reddit without an approved bot account

**Risk:** Account ban, subreddit ban, IP ban, legal action.

## Security Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| OAuth tokens stored in DB | High | Encrypt at rest (add at-rest encryption for `oauth_*` columns) |
| API keys in environment | Medium | Use Replit Secrets, never commit to git |
| Proxy credentials in DB | Medium | Encrypt `proxy_config` field in production |
| No rate limiting on API | Medium | Add rate limiting middleware (e.g., `express-rate-limit`) |
| No authentication on routes | High | Add auth middleware before deploying publicly |

## Recommendations Before Production Use

1. **Add authentication** — All API routes are currently unauthenticated. Add JWT or session-based auth.
2. **Encrypt sensitive DB fields** — `oauth_access_token`, `oauth_refresh_token`, `proxy_config` should be encrypted at rest.
3. **Add rate limiting** — Use `express-rate-limit` to prevent abuse.
4. **Use residential proxies** — Shared datacenter proxies are frequently detected and blocked.
5. **Respect platform rate limits** — Build in delays between actions per account.
6. **Start small** — Test with 1-2 accounts before scaling.
7. **Human approval workflow** — Use the draft→approve→publish flow for sensitive accounts.

## Legal Notes

- This tool is provided for educational and research purposes only.
- The authors make no warranty regarding compliance with platform ToS.
- Consult a lawyer before using automated social media tools commercially.
- GDPR / CCPA: User data (OAuth tokens) must be handled per applicable privacy laws.

## Ethical Considerations

- Automated posting can contribute to spam and misinformation.
- Coordinated inauthentic behavior undermines trust in social platforms.
- Use this tool responsibly and transparently.
