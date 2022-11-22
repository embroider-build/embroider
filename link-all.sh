#!/bin/bash
#
# requires
#   - jq, https://stedolan.github.io/jq/
#
# optionally takes one argument
#   the path to link up
#
# example (in the embroider root directory)
#   yarn link:all ../my-other-project/sub-directory
#
#   the project, my-other-project/sub-directory will be linked up locally to embroider

function get_workspaces() {
  yarn workspaces --json info --json | jq '.data' -r | jq 'map(.location) | .[]' -r
}

embroider_packages=$(get_workspaces | grep ^packages)

target_project=$1

for path in $embroider_packages
do
  name=$(cd $path && cat package.json | jq '.name' -r)

  if  [ -z "$target_project" ]; then
    echo "Linking everything"

    ( cd $path && yarn link )
  else
    if [ -z "$(cat $target_project/package.json | grep $name)" ]; then
      echo "Skipping $name. Not present in target project."
    else
      echo "Linking $name"
      ( cd $path && yarn link )
      ( cd $target_project && yarn link $name )
    fi
  fi
done

