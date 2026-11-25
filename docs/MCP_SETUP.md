# MCP setup

This project configures four MCP servers in `.cursor/mcp.json`. Cursor merges that file with the user config at `~/.cursor/mcp.json`. The user file already contains the Atlassian server and was not changed.

None of these servers are authenticated yet. Cursor will not show their tools until you complete the manual steps below and reload MCP.

## Servers

| Name | Purpose | Transport | Auth |
| --- | --- | --- | --- |
| `expo` | Expo docs, builds, workflows, and optional local app inspection | `https://mcp.expo.dev/mcp` | Expo OAuth |
| `supabase` | Schema, SQL, migrations, and database debugging for one development project | `https://mcp.supabase.com/mcp` | Supabase OAuth |
| `github` | Repositories, issues, and pull requests | `https://api.githubcopilot.com/mcp/` | Personal access token |
| `playwright` | Browser automation for web pages and admin dashboards | local `npx` | None |

## What you need to do

1. Set `GITHUB_PERSONAL_ACCESS_TOKEN` in a place the Cursor app can read. A variable exported in a terminal is not visible to Cursor if you opened Cursor from the Dock. Quit Cursor, then start it from that same terminal with `open -a Cursor`, or set the variable for the GUI session and restart Cursor.
2. Open **Cursor Settings → Tools & MCP**. Confirm `expo`, `supabase`, `github`, and `playwright` are listed.
3. Complete authentication for Expo, Supabase, and GitHub. Playwright has no login.
4. Keep tool approval on, and read each tool call before you allow it.

### Environment variables

| Variable | Used by | Value |
| --- | --- | --- |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | GitHub `Authorization` header | A GitHub personal access token. Do not paste it into `mcp.json`. |

The Supabase MCP URL is already scoped to development project `flbdllwugemxjjpcawku`. The API reads `server/.env.local`, which has that ref and `SUPABASE_URL`. Add `SUPABASE_SERVICE_ROLE_KEY` there when you want saved slips to persist. Do not put the service-role key in MCP config, in the mobile app, or in git.

Create the token at [GitHub personal access tokens](https://github.com/settings/personal-access-tokens/new). Grant only the repositories and permissions you want Cursor to use. The default GitHub MCP toolsets are `context`, `repos`, `issues`, `pull_requests`, and `users`.

### Expo

Cursor opens a browser sign-in the first time it connects. Use the same Expo account you use for EAS.

The remote server can read Expo docs and, after the project is linked to an Expo account, work with builds and workflows. Screenshots, taps, DevTools, and device logs are local capabilities. They need a separate dev dependency and a running Metro server:

```bash
cd mobile
npx expo install expo-mcp --dev
npx expo whoami || npx expo login
EXPO_UNSTABLE_MCP_SERVER=1 npx expo start
```

That package is not installed. Local iOS inspection works on the simulator from a Mac, not on a physical phone. Reconnect the Expo MCP server after you start or stop Metro.

Server tools include documentation, usage budgets, workflows, builds, sandboxes, cloud simulators, automation, TestFlight, App Store, Play Store, and Expo Observe. Local tools, once `expo-mcp` is running, include `expo_router_sitemap`, `open_devtools`, `collect_app_logs`, and the local automation tools. The live list is on [Expo MCP](https://docs.expo.dev/mcp/).

### Supabase

Sign in through the browser prompt and choose the organization that owns the development project. No personal access token is required for this OAuth flow.

The URL is limited to project `flbdllwugemxjjpcawku` and to the `database`, `debugging`, `development`, and `docs` groups. Account tools such as creating or pausing projects are unavailable while a project ref is set. Storage, Edge Functions, branching, and notebooks are not enabled.

Enabled tools:

- Database: `list_tables`, `list_extensions`, `list_migrations`, `apply_migration`, `execute_sql`
- Debugging: `query_logs`, `get_advisors`
- Development: `get_project_url`, `get_publishable_keys`, `generate_typescript_types`
- Docs: `search_docs`

`apply_migration` and `execute_sql` can change data in project `flbdllwugemxjjpcawku`. Use that project for development only. Supabase may ask you to confirm destructive SQL. Leave that confirmation on.

To inspect without writes, add `&read_only=true` to the URL. That runs SQL as a read-only database user and is the right setting for an unattended check.

### GitHub

Cursor’s GitHub install guide says the hosted server needs a personal access token. OAuth for that remote server is not available in Cursor. Docker is not installed on this machine, so the local Docker server, which can use OAuth, is not configured.

The header is `Bearer ${env:GITHUB_PERSONAL_ACCESS_TOKEN}`. The token is not stored in the repo. If the variable is missing, GitHub MCP will fail to authenticate.

Default tools cover the signed-in user, repositories, issues, and pull requests. The full tool list is in the [GitHub MCP server README](https://github.com/github/github-mcp-server).

### Playwright

Cursor starts `npx -y @playwright/mcp@latest`. The first launch can download the package and browser binaries. No token is required.

The server drives a browser: navigate, snapshot, click, type, fill forms, read console and network output, and take screenshots. Use it for a web dashboard. It does not drive the Expo Go app.

`browser_run_code_unsafe` runs arbitrary Playwright code in the server process. Leave approval on for that tool.

## Troubleshooting

- A server is missing: reload the window, or toggle the server off and on under **Tools & MCP**. Project config wins when the same server name exists in both MCP files.
- Expo or Supabase stays on “Needs login”: use the Connect or login control next to that server and finish the browser flow. Authentication was not completed during setup.
- GitHub returns 401: the Cursor process cannot see `GITHUB_PERSONAL_ACCESS_TOKEN`, or the token does not have the scopes for the tool it called. Restart Cursor from a terminal where `echo $GITHUB_PERSONAL_ACCESS_TOKEN` prints the token. Do not print the token into chat.
- Supabase connects to the wrong project: `.cursor/mcp.json` must keep `project_ref=flbdllwugemxjjpcawku`. Reload MCP after changing that URL.
- Supabase writes are refused: the URL may include `read_only=true`, or the database role cannot change schema.
- Playwright never becomes ready: run `npx -y @playwright/mcp@latest --help` in a terminal. Node.js 22 and npm 10 are already installed. Check **Output → MCP Logs**.
- Logs: **Output** (`Cmd+Shift+U`) → **MCP Logs**.

## Security

- `.cursor/mcp.json` contains URLs and `${env:...}` references. Do not replace those references with a token, a service-role key, or a database password.
- The mobile app must keep talking to Express. Do not add the Supabase service-role key to `mobile/`.
- Review every MCP tool call. A prompt in database content or a web page can ask the agent to run a tool.
- GitHub access follows the token you create. Prefer a fine-grained token on the repositories you intend to use.
- Playwright can open any URL you approve and can run page JavaScript. Do not point it at a session that is logged into production admin tools unless that is the task.
- Setup did not run SQL, create a Supabase project, or change application dependencies.
)
