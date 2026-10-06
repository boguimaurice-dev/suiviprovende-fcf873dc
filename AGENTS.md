<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Consumption analytics use calendar formula quantities and current material prices, excluding stock movements to avoid double-counting production.
- Render Recharts in an isolated analysis route embedded in the legacy dashboard; exchange only same-origin parent messages and never fetch account data there.
- Import pending member entries with an authenticated, security-invoker database transaction locking the owner's app data; persist changes and imported markers atomically before loading the dashboard.
