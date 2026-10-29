# Keen Design System: Research and Architecture Summary

## 1. Project vision

Keen is a design system I'm building to learn, document my engineering decisions, and create a strong portfolio example.

Its central idea is **shared components with product-owned theming**: components keep a consistent structure and behavior across repositories, while each product supplies its own visual identity.

Potential consumers include Job Scout, Brain CLI, Kid Coins, and the portfolio blog. **The portfolio blog is the first integration target**, with AI chat as the first milestone.

The goal is not to build a large component catalog immediately. First, demonstrate that one useful component can be designed, documented, shared, and themed in a real host application.

## 2. Research references

- [Southleft: Machine-Readable Design Tokens for AI-Ready Component Libraries](https://southleft.com/insights/design-systems/machine-readable-design-tokens-for-ai-ready-component-libraries/)
- [Uber Base MCP](https://uber.design/base-mcp)
- [Uber: How Uber Built an Agentic System to Automate Design Specs in Minutes](https://www.uber.com/gb/en/blog/automate-design-specs/)
- [Graphiti](https://github.com/getzep/graphiti), the knowledge-graph tool mentioned in the LinkedIn post

## 3. What the research suggests

### Design systems need more than a `design.md`

An overview document can be a useful entry point, but it does not provide enough detail for engineers or AI agents to apply a system consistently. Useful component knowledge includes:

- Purpose and when to use the component
- Anatomy and subcomponents
- Variants and their intended use
- States and transitions
- Interaction and keyboard behavior
- Accessibility requirements
- Usage guidance and common mistakes
- Token and component dependencies

The LinkedIn post proposes connecting this knowledge in a graph. That is one possible retrieval approach. The immediate opportunity for Keen is to structure and link the knowledge clearly in the repository. A graph is useful only if the underlying content is organized and maintained.

### Tokens should be machine-readable

Southleft's article recommends making tokens usable by tools, not only readable by people. A token system can separate:

- **Primitive tokens:** raw palette, type scale, spacing scale, radii
- **Semantic tokens:** roles such as surface, text, border, action, and focus
- **Component tokens:** component-specific decisions for variants and states

A build step can transform the canonical token source into CSS variables or other formats. This makes tokens easier to validate, theme, distribute, and expose to AI tools.

The important constraint is to avoid maintaining separate sources by hand.

### AI benefits from relevant context

The research and examples point toward giving AI tools relevant, connected context instead of including the entire design system in every prompt.

For example, to implement a chat composer, an agent might need:

- The composer API, variants, and states
- The semantic tokens it uses
- Accessibility and keyboard requirements
- The host application's theme contract
- A working usage example

Uber Base MCP and Uber's design-spec automation are examples of connecting design information with AI and implementation workflows. Keen can learn from these patterns without reproducing Uber's scale or tooling.

### Shared UI needs clear package boundaries

Components meant to work across projects should not depend on host-specific behavior. The portable layer should generally avoid importing:

- Framework-specific routing
- Product-specific stores or data models
- Provider credentials or API clients
- Browser-extension APIs
- App-specific navigation and copy

The host application should supply what varies: theme tokens, translations, callbacks, and integration adapters.

## 4. Recommended architecture

```text
Design source and token definitions
                 ↓
        Generated token outputs
                 ↓
 Shared component package + docs
                 ↓
       Host application adapters
                 ↓
 Portfolio blog, then other repos
                 ↓
          MCP context layer
```

### Design source and tokens

Define a canonical token source and generate the formats that consuming projects need. Start with a small semantic token contract. Components should consume roles like `surface`, `text-primary`, `border`, and `action-primary` rather than hard-coded brand colors.

Each product maps those roles to its own brand. This keeps shared component logic stable while allowing Job Scout and Kid Coins to look different.

### Shared component package

Build reusable components in a package with intentional public APIs. Include components that have proved useful in more than one context, or that are needed for the current milestone.

The host app owns app-specific composition and behavior. The shared package owns reusable interaction patterns and presentation.

### Documentation tied to implementation

Document component APIs and design contracts close to source. Link implementation examples to design references, and distinguish current behavior from planned direction.

### MCP as a context interface

Treat MCP as a way to query and deliver the structured system knowledge. It should use the same token definitions and component documentation as engineers, rather than becoming a separate copy that drifts.

For example, an AI tool might request "chat composer for portfolio-blog" and receive the relevant API, state guidance, accessibility constraints, token mappings, and integration notes.

## 5. First milestone: AI chat in portfolio-blog

The first milestone should prove that a chat component can be shared with and themed by another repository.

The initial chat surface should establish:

- A product-independent component API and interaction model
- Empty, loading, streaming, error, and completed states (the README adds stopped by user and error mid-stream)
- Theme customization through tokens provided by the host
- Responsive behavior
- Keyboard and focus support
- Integration instructions and a working example in portfolio-blog

The first milestone focuses on **chat UI and reusable interaction behavior**. The chat component does not need to own the AI model, provider, credentials, or conversation persistence. The host application can connect those responsibilities through props or adapters.

A useful completion check is: portfolio-blog imports the shared chat component, applies its own theme, and renders the documented states without copying the component implementation.

## 6. Suggested implementation sequence

1. **Write the vision and boundaries.** Define what Keen owns, what the host app owns, and the first consumer.
2. **Inspect portfolio-blog.** Confirm its framework, styling setup, deployment constraints, and UI conventions, then validate the settled React, package, token, and integration decisions against the host.
3. **Design the chat experience.** Specify layout, interaction states, responsive behavior, and accessibility expectations.
4. **Define the initial theme contract.** Choose only the semantic tokens the chat needs, then test that portfolio-blog can map its brand into them.
5. **Implement a narrow shared package.** Keep its exports and dependencies focused on the chat milestone.
6. **Integrate in portfolio-blog.** Connect host AI behavior and theming without copying Keen's component source.
7. **Document and demonstrate.** Add setup instructions, API reference, state examples, and architecture rationale.
8. **Evaluate MCP.** Expose component and token guidance after it exists, then check whether an AI agent can use it to create a consistent implementation.
9. **Test a second consumer.** Reuse the chat component in another repository to find which parts are truly portable.

## 7. Approaches and tradeoffs

| Approach | Benefits | Costs and risks |
| --- | --- | --- |
| Build Keen's own system from the start | Strong learning and portfolio value; control over architecture and documentation; direct validation of the sharing and theming goal | More foundational work; slower first implementation; risk of overbuilding before reuse is proven |
| Use an existing component system and add Keen documentation or MCP | Faster initial implementation; less low-level UI work | Less evidence of designing and evolving a system; host-specific assumptions may limit reuse |
| Use accessible primitives while owning Keen's components, tokens, docs, and integration | Balances speed with system ownership; underlying primitives can handle complex interactions | Requires clear boundaries so Keen is more than a thin rebrand of another library |

### Recommendation

Build Keen's design-system layer, using established accessible primitives where they help. Own the component APIs, theme contract, documentation, packaging, and MCP context. Keep the first implementation narrow and prove it in portfolio-blog before expanding.

## 8. What to avoid early

- Building a full design-system portal before a component is used
- Treating a knowledge graph as a prerequisite
- Publishing to public npm before the API and consumer needs are understood
- Copying the same component implementation between repositories
- Putting product-specific logic or provider secrets in the shared UI package
- Documenting components separately from their actual APIs and states
- Adding token categories without a real consumer need

## 9. Portfolio story

The strongest portfolio story will show how the system evolved:

- The problem Keen addresses
- The architecture and boundary decisions
- Why AI chat was chosen as the first component
- How portfolio-blog consumes and themes it
- What reuse revealed about the API and package
- How an AI agent retrieves and applies the system's guidance
- What tradeoffs changed as the system reached a second consumer
