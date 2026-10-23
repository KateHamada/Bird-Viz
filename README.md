# Bird Visualization

Website link: https://katehamada.github.io/Bird-Viz/

A GitHub Pages (Jekyll) site that turns a CSV file into interactive graphs and tables.

If Jekyll is working for you you can preview locally with `bundle exec jekyll serve`.

Or push to the main branch in order to see the changes.

### Here's a guide to downloading jekyll
Link to a steps: https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/creating-a-github-pages-site-with-jekyll 

- Install Ruby+Devkit
- Base installation and MINGW development toolchain
- Go to Terminal:
    - gem install jekyll bundler
- Navigate to where the github page is stored locally (using cd “project_path”)
- jekyll new . --skip-bundle --force
- Edit the Gemfile
- Comment out:
```gem "jekyll", "~> 4.4.1"```
```gem "minima", "~> 2.5"```
- Uncomment:
```gem "github-pages", group: :jekyll_plugins```
