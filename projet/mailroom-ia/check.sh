#!/bin/sh
echo "CLIENT_ID=$AZURE_CLIENT_ID"
echo "STORAGE_BLOB_URL=$STORAGE_BLOB_URL"
echo "IDENTITY_ENDPOINT=$IDENTITY_ENDPOINT"
echo "---"
wget -qO- --header="X-IDENTITY-HEADER: $IDENTITY_HEADER" "${IDENTITY_ENDPOINT}?api-version=2019-08-01&resource=https%3A%2F%2Fstorage.azure.com%2F&client_id=${AZURE_CLIENT_ID}" | head -c 500
echo ""
