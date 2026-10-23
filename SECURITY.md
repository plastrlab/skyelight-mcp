# Security

To report a security problem in `@skyelight/mcp`, the hosted server at
`https://app.skyelight.ai/mcp`, or Skyelight itself, email
**support@skyelight.ai** with what you found and how to reproduce it. Please
don't open a public issue for it. We'll confirm we have it and tell you when
it is fixed.

The server acts only as the person signed in, or the owner of the personal
token, and reaches only the workspaces they can open in the web app. Tools
that change anything are marked as writes, so clients can ask before they run
(see [Tools](README.md#tools)).
