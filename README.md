# Bird Visualization

Website link: https://katehamada.github.io/Bird-Viz/

A GitHub Pages (Jekyll) site for our Bird Visualization Dashboard.

## Guide to local set up
*Mac might not work perfectly I have windows so I can’t check sorry*
1. Install Ruby 3.3
Windows:
```winget install RubyInstallerTeam.RubyWithDevKit.3.3```
```$env:Path = "C:\Ruby33-x64\bin;" + $env:Path```
Mac:
```brew install ruby@3.3```
```echo 'export PATH="/opt/homebrew/opt/ruby@3.3/bin:$PATH"' >> ~/.zshrc```
```source ~/.zshrc```
2. Confirm version 3.3 with: 
```ruby -v```
3. Install more stuff
```gem install bundler```
```bundle install```
```bundle update github-pages```
4. Run locally
```bundle exec jekyll serve```

If you can't run locally in a worst case you can push to the main branch in order to see the changes but it's not ideal since there's multiple of us working on this project.

