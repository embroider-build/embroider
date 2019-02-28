#!/bin/bash

./scripts/parallel --tag <<EOF
yarn node-test
cd test-packages/macro-tests && ember test
EOF
