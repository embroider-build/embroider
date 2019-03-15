#!/bin/bash

# To add a new test suite, put it into this switch statement and *also* into the
# list in allSuites below.
function main {
  case "$1" in
  "node")
    # the JOBS=1 is an attempt to workaround hanging broccoli-babel-transpiler
    # workers in Travis
    JOBS=1 yarn node-test
    ;;
  "macro-classic")
    cd test-packages/macro-tests && CLASSIC=true yarn test
    ;;
  "macro")
    cd test-packages/macro-tests && yarn test
    ;;
  "macro-addon")
    cd test-packages/macro-sample-addon && yarn test
    ;;
  "macro-addon-classic")
    cd test-packages/macro-sample-addon && CLASSIC=true yarn test
    ;;
  "static-app")
    cd test-packages/static-app && yarn test
    ;;
  "static-app-classic")
    cd test-packages/static-app && CLASSIC=true yarn test
    ;;
  *)
    allSuites
    ;;
  esac
}

function allSuites {
  ./scripts/parallel --tag $0 <<EOF
  node
  macro-classic
  macro
  macro-addon
  macro-addon-classic
  static-app
  static-app-classic
EOF
}

function prettyStatus {
  if [ -t 1 ] ; then
    # inside a terminal, so use color
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    NC='\033[0m' # No Color

    if [ $1 -eq 0 ]; then
      printf "${GREEN}All tests passed${NC}\n"
    else
      printf "${RED}Some tests failed${NC}\n"
    fi
  else
    if [ $1 -eq 0 ]; then
      printf "All tests passed\n"
    else
      printf "Some tests failed\n"
    fi
  fi
}

main $1
status=$?
prettyStatus $status
exit $status;
