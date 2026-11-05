# Bird Visualization

Website link: https://katehamada.github.io/Bird-Viz/

A GitHub Pages (Jekyll) site for our Bird Visualization Dashboard for ICS 484 Data Visualization class.

## Local Development Guide

### 1. Install Ruby 3.3

#### Windows Setup
Open PowerShell as Administrator and run:
```powershell
winget install RubyInstallerTeam.RubyWithDevKit.3.3
$env:Path = "C:\Ruby33-x64\bin;" + $env:Path
```

#### MacOS Setup
Open Terminal and run (requires [Homebrew](https://brew.sh/)):
```zsh
brew install ruby@3.3
echo 'export PATH="/opt/homebrew/opt/ruby@3.3/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

---

### 2. Verify Installation
Check that Ruby 3.3 is active in your terminal:
```bash
ruby -v
```

---

### 3. Install Dependencies
Navigate to your local repository directory and run:
```bash
gem install bundler
bundle install
bundle update github-pages
```

---

### 4. Run Locally
Launch the Jekyll local development server:
```bash
bundle exec jekyll serve
```
You should see something like this:
```
[stuff]...
    Server address: http://127.0.0.1:4000/Bird-Viz/
  Server running... press ctrl-c to stop.
Terminate batch job (Y/N)? 
```
Open `http://127.0.0.1:4000/Bird-Viz/` in your web browser to preview your site.

---
## Overview
- Not Done

