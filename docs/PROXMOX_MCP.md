# Proxmox MCP Plus (אופציונלי)

כלי לניהול/ניטור Proxmox מתוך Cursor דרך [ProxmoxMCP-Plus](https://github.com/RekklesNA/ProxmoxMCP-Plus).

## 1. קובץ קונפיג (מקומי בלבד)

```text
tools/proxmox-mcp-plus/proxmox-config/config.example.json
  → העתק ל־
tools/proxmox-mcp-plus/proxmox-config/config.json
```

`config.json` ב־`.gitignore` — אל תדחוף טוקנים ל־Git.

ערוך:

- `proxmox.host` — כתובת ה־PVE (למשל IP הצומת)
- `proxmox.verify_ssl` — `false` אם תעודה עצמית חתומה
- `auth` — משתמש API + `token_name` + `token_value` (מ־Datacenter → Permissions → API Tokens)

## 2. הרשאות ב־Proxmox (תיקון 403)

אם ב־MCP מופיעים `403 Forbidden` עם `Sys.Audit` או `VM.Audit`, הטוקן חסר הרשאות צפייה.

**Datacenter → Permissions → Add:**

| שדה | ערך מומלץ |
|-----|------------|
| Path | `/` |
| User / API Token | לדוגמה `root@pam!mcp-proxmox` (לפי מה שיצרת) |
| Role | **`PVEAuditor`** (קריאה בלבד; מתאים ל־`get_cluster_status`, `get_containers`, `get_container_config`) |

לפעולות הרסניות (מחיקה/שחזור) ייתכן שיידרשו תפקידים נוספים — עדיף טוקן ייעודי עם מינימום הרשאות לפי הצורך.

## 3. Cursor — להצביע על הקונפיג

החבילה תומכת במשתנה סביבה **`PROXMOX_MCP_CONFIG`** = נתיב **מוחלט** ל־`config.json`.

ב־**Cursor Settings → MCP** (או `mcp.json`), הוסף לשירות `proxmox-mcp-plus` משהו בסגנון:

```json
{
  "mcpServers": {
    "proxmox-mcp-plus": {
      "command": "uv",
      "args": ["run", "--directory", "C:\\path\\to\\proxmox-mcp-plus", "proxmox-mcp-plus"],
      "env": {
        "PROXMOX_MCP_CONFIG": "C:\\path\\to\\Finance_App\\tools\\proxmox-mcp-plus\\proxmox-config\\config.json"
      }
    }
  }
}
```

התאם את `command` / `args` להתקנה אצלך (Python venv, `npx`, וכו'). המפתח הוא **`PROXMOX_MCP_CONFIG`** עם נתיב נכון — בלי זה השרת עלול ליפול לערכי דמה (`your-proxmox-host-ip`).

לאחר שינוי: **Reload** ל־MCP או restart ל־Cursor.

## 4. אימות

לאחר תיקון ACL וקונפיג, בקש מהסוכן להריץ (דרך MCP):

- `get_cluster_status`
- `get_containers` (לאמות CT כמו 115)
- `get_container_config` עם `node` + `vmid`

## הפניות

- [RekklesNA/ProxmoxMCP-Plus — agent installation](https://github.com/RekklesNA/ProxmoxMCP-Plus/blob/main/docs/agent-installation.md)
- משכורות / DB: [SALARY_EFFECTIVE_DATE.md](SALARY_EFFECTIVE_DATE.md)
