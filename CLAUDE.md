# Bash commands

Never use multiline bash commands. Always collapse everything onto a single line using `&&`, `;`, or appropriate quoting. This includes git commit messages — use `-m 'message'` with a single-quoted inline string, never a heredoc.
# Git commits

Do not commit after completing a feature or fix.

When asked to implement a new feature: if there are uncommitted changes from previous work, commit those first (without asking), then start the new feature.
