#!/usr/bin/env python
# -*- coding: utf-8 -*-
#########################################################################
#
# Copyright 2018, GeoSolutions Sas.
# All rights reserved.
#
# This source code is licensed under the BSD-style license found in the
# LICENSE file in the root directory of this source tree.
#
#########################################################################
import os
from setuptools import setup, find_packages

here = os.path.abspath(os.path.dirname(__file__))

def get_version():
    version = open('VERSION','r').read()
    version = version.replace('\n','')
    return version

setup(
    version=get_version(),
    long_description=open(os.path.join(here, 'README.md')).readline(),
    long_description_content_type='text/markdown',
)
