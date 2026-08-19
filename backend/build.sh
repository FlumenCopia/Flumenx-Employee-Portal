#!/bin/bash
set -e

echo "Executing deploy-time database migrations..."
python manage.py migrate --noinput

echo "Executing deploy-time Super Admin bootstrap..."
python manage.py ensure_permanent_superadmin
