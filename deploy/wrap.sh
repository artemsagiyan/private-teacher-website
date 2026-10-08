#!/bin/bash
bash /root/tutor-platform/deploy/apply-previous.sh
ec=$?
if [ $ec -ne 0 ]; then echo DEPLOY_FAIL; fi
