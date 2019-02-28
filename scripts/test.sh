#!/bin/bash

./scripts/parallel --tag <<EOF
yarn node-test
cd test-packages/macro-tests && CLASSIC=true ember test
cd test-packages/macro-sample-addon && CLASSIC=true ember test
EOF

# disabled tests suites
# cd test-packages/macro-tests && ember test
# cd test-packages/macro-sample-addon && ember test
