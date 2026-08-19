#!/bin/bash
set -e

echo "Executing deploy-time database migrations..."
python manage.py migrate --noinput
