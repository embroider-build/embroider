#!/bin/bash

./scripts/parallel --tag <<EOF
yarn node-test
cd test-packages/macro-tests && CLASSIC=true ember test
cd test-packages/macro-tests && ember test
cd test-packages/macro-sample-addon && CLASSIC=true ember test
EOF

status=$?

if [ -t 1 ] ; then
  # inside a terminal, so use color
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  NC='\033[0m' # No Color

  if [ $status -eq 0 ]; then
    printf "${GREEN}All tests passed${NC}\n"
  else
    printf "${RED}Some tests failed${NC}\n"
  fi
else
  if [ $status -eq 0 ]; then
    printf "All tests passed\n"
  else
    printf "Some tests failed\n"
  fi
fi

exit $status;
