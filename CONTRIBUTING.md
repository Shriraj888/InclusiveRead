# Contributing to InclusiveRead

First off, thank you for considering contributing to InclusiveRead! It's people like you that make InclusiveRead such a great tool for improving web accessibility.

## Code of Conduct

This project and everyone participating in it is governed by a code of respect and inclusivity. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title**
* **Describe the exact steps to reproduce the problem**
* **Provide specific examples** (URLs, browser version, screenshots)
* **Describe the behavior you observed and what you expected**
* **Include details about your configuration** (browser version, OS, API provider)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title**
* **Provide a step-by-step description of the suggested enhancement**
* **Provide specific examples to demonstrate the steps**
* **Describe the current behavior and the expected behavior**
* **Explain why this enhancement would be useful**

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. Ensure your code follows the existing style
4. Make sure your code lints
5. Issue that pull request!

## Development Setup

1. Fork and clone the repository
2. Load the extension in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the project directory
3. Make your changes
4. Test thoroughly on various websites
5. Submit a pull request

## Coding Guidelines

### JavaScript Style
- Use ES6+ features where appropriate
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused
- Handle errors gracefully

### Commit Messages
- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit first line to 72 characters
- Reference issues and pull requests liberally

### Documentation
- Update README.md if you change functionality
- Comment complex code blocks
- Update the manifest.json version if needed

## Areas for Contribution

- **Features**: New accessibility features or enhancements
- **Bug Fixes**: Identify and fix bugs
- **Documentation**: Improve or add documentation
- **Testing**: Add test coverage
- **Performance**: Optimize code for better performance
- **UI/UX**: Improve the user interface and experience
- **Accessibility**: Make the extension itself more accessible

## Priority Areas

- Additional language support
- Firefox and Edge compatibility
- Enhanced dyslexia reading features
- Performance optimizations
- Screen reader integration
- Mobile browser support

## Testing Checklist

Before submitting a pull request, please test:

- [ ] Extension loads without errors
- [ ] All four modes work correctly
- [ ] Settings persist across browser sessions
- [ ] Works on various websites (government, educational, news)
- [ ] No console errors
- [ ] API keys are stored securely
- [ ] UI is responsive and accessible
- [ ] Dark/light themes work properly

## Questions?

Feel free to open an issue with your question or reach out to the maintainers.

Thank you for contributing to making the web more accessible! 🎉
