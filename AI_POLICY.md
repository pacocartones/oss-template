# AI Policy

*Own text, informed by the AI policies of the [Linux kernel](https://docs.kernel.org/process/coding-assistants.html), [Ansible](https://docs.ansible.com/projects/ansible/13/community/ai_policy.html), [OpenShadingLanguage](https://github.com/AcademySoftwareFoundation/OpenShadingLanguage/blob/main/docs/dev/AI_Policy.md) and LLVM (as collected in [melissawm/open-source-ai-contribution-policies](https://github.com/melissawm/open-source-ai-contribution-policies)). No text is copied from them.*

## How we work

Most changes in this project are drafted by AI agent sessions. A named human maintainer (see MAINTAINERS.md) reviews every pull request, and only a human merges. Our own commits carry no AI trailer or footer.

## Contributions from outside

- AI assistance is allowed.
- Say so: add `Assisted-by: <tool>/<model>` to the commit message, and tick the line in the pull request template.
- You are the author. Understand every line, run the checks, and be ready to explain the change in review.
- An AI tool never signs off (`Signed-off-by`) or appears as a co-author; only people do.
- Issues labelled `good first issue` are kept for people learning the project; please do not solve them with an agent.
- Maintainers may close a pull request that is undisclosed, unreviewed or not understood by its author.
