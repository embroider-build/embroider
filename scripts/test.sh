#!/bin/bash

./scripts/parallel --tag <<EOF
yarn node-test
cd test-packages/macro-tests && ember test
cd test-packages/macro-sample-addon && ember test
EOF
