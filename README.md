# Golden Gate Classic website

This is the informational website for the Golden Gate Classic, an IGBO-affiliated bowling tournament. The site is available at [www.goldengateclassic.org](http://www.goldengateclassic.org).

It's built as a static website using the [Next.js](https://nextjs.org/) framework and [React-Bootstrap](https://react-bootstrap.github.io/).

It uses Bootstrap 5, and I started the design with mobile viewports, then adapted them for medium and large ones. Since two out of every three visitors is on a mobile device, it seemed like the best approach.

## Learning

I have also used this project to further my understanding of Bootstrap's implementation of color modes, and how Sass works vs. CSS variables. It's very cool stuff, and as someone coming from the backend world of software development, it's been fun to see how it all ties together.

## Development & local running

1. Clone this repository
2. Install [Node.js](https://nodejs.org/en/)
3. Run `npm install`
4. To run a development server, run `npm run dev` and have at it!

## Deployment

Deployment scripts are located in the `deploy_scripts/` directory. **Important: These scripts must be run from the project root directory** because they use relative paths to locate the `out` directory created by the build process.

### Quick Start

1. **Set up SSH keys** (recommended for passwordless deployment):
   ```bash
   ./deploy_scripts/setup-ssh.sh <ssh_user@server> <server_alias>
   ```
   Example: `./deploy_scripts/setup-ssh.sh jfuggc@54.70.1.215 sfggc-server`

2. Build the static site:
   ```bash
   ./deploy_scripts/build.sh
   ```
   Or manually: `npm run build`

3. Deploy using the automated script (from the project root):
   ```bash
   ./deploy_scripts/deploy.sh <ssh_user@server> <domain_path> <domain_name>
   ```
   Or use the server alias if you set up SSH keys:
   ```bash
   ./deploy_scripts/deploy.sh <server_alias> <domain_path> <domain_name>
   ```

4. Or use the manual deployment script for step-by-step deployment:
   ```bash
   ./deploy_scripts/deploy-manual.sh <ssh_user@server> <domain_path> <domain_name>
   ```

For detailed deployment instructions, see the [deployment guide](deploy_docs/DEPLOYMENT.md).

If you encounter server permission issues or other deployment problems, see [SERVER_SETUP.md](SERVER_SETUP.md) for troubleshooting steps and server configuration guidance.

**Web Server Configuration:**
- Using **Apache**: The deployment script automatically configures `.htaccess` for you
- Using **Nginx**: See the nginx configuration guides in [`deploy_docs/`](deploy_docs/) for setup instructions

## Portal

The repository also includes a tournament portal for admin and participant access. The portal runs as a Next.js server application with MariaDB.

- **Portal documentation**: [`portal_docs/README.md`](portal_docs/README.md)
- **Setup guide**: [`portal_docs/PORTAL_SETUP.md`](portal_docs/PORTAL_SETUP.md)
- **Portal deployment**: [`deploy_docs/PORTAL_DEPLOYMENT.md`](deploy_docs/PORTAL_DEPLOYMENT.md)

### Portal migrations (developer workflow)

- Portal deploys run migrations automatically from `backend/scripts/migrations/`.
- Local schema setup now also runs all portal migrations:
  - `bash scripts/dev/init-portal-db.sh`
- Existing workspaces: pull latest code and re-run `bash scripts/dev/init-portal-db.sh` (or run only migrations with `bash scripts/dev/run-portal-migrations.sh`).
- First-time workspaces: after creating `.env.local`, run `bash scripts/dev/init-portal-db.sh`; it initializes schema and applies migrations in one flow.

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
[MIT](https://choosealicense.com/licenses/mit/)
