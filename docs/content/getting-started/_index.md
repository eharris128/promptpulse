---
title: "Getting Started"
linkTitle: "Getting Started"
weight: 1
description: "Quick start guide for PromptPulse"
---

# Getting Started with PromptPulse

PromptPulse is a command-line tool and web dashboard for tracking Claude Code usage analytics. This guide will help you get up and running quickly.

## Installation

Install PromptPulse globally using npm:

```bash
npm install -g promptpulse
```

## Quick Start

### 1. Create Account and Login

Create a new account or login with your API key:

```bash
# Interactive account creation
promptpulse login

# Or login with an existing API key
promptpulse login --api-key your-api-key-here
```

### 2. Verify Your Setup

Check your login status:

```bash
promptpulse whoami
```

### 3. Collect Your First Data

Start collecting Claude Code usage data:

```bash
# Collect all available data
promptpulse collect

# Or collect specific granularity
promptpulse collect --granularity daily
```

### 4. Set Up Automatic Collection

Configure automatic data collection:

```bash
# Set up 15-minute collection (default)
promptpulse setup

# Set up hourly collection
promptpulse setup --interval 60

# Set up daily collection
promptpulse setup --interval daily
```

### 5. View Your Dashboard

Open your web dashboard:

```bash
promptpulse dashboard
```

## Next Steps

- [CLI Reference](../cli-reference/) - Complete command documentation
- [Dashboard Guide](../dashboard/) - Web interface walkthrough
- [Teams](../teams/) - Team collaboration features
- [Privacy](../privacy/) - Understanding data collection

## Quick Commands Reference

| Command | Description |
|---------|-------------|
| `promptpulse login` | Create account or login |
| `promptpulse whoami` | Show current user |
| `promptpulse collect` | Collect usage data |
| `promptpulse setup` | Configure automatic collection |
| `promptpulse status` | Check collection health |
| `promptpulse dashboard` | Open web dashboard |
| `promptpulse doctor` | Diagnose issues |