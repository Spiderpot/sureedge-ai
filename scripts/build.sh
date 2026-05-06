#!/bin/sh
unset TURBOPACK
npx prisma generate
npx next build
