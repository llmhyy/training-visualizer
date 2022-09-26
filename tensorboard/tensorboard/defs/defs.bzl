# Copyright 2016 The TensorFlow Authors. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""External-only delegates for various BUILD rules."""

load("@npm_bazel_rollup//:index.bzl", "rollup_bundle")
load("@npm_bazel_karma//:index.bzl", "karma_web_test_suite")
load("@npm_bazel_typescript//:index.bzl", "ts_config", "ts_devserver", "ts_library")


def tensorboard_webcomponent_library(**kwargs):
    """Rules referencing this will be deleted from the codebase soon."""
    pass

def tf_js_binary(compile, deps, **kwargs):
    """Rules for creating a JavaScript bundle.

    Please refer to https://bazelbuild.github.io/rules_nodejs/Built-ins.html#rollup_bundle
    for more details.
    """

    # `compile` option is used internally but is not used by rollup_bundle.
    # Discard it.
    rollup_bundle(
        config_file = "//tensorboard/defs:rollup_config.js",
        # Must pass `true` here specifically, else the input file argument to
        # Rollup (appended by `rollup_binary`) is interpreted as a value for
        # the preceding option.
        # args = ["--failAfterWarnings", "true", "--silent", "true"],
        args = ["--silent", "false"],
        deps = deps + [
            "@npm//@rollup/plugin-commonjs",
            "@npm//@rollup/plugin-node-resolve",
        ],
        format = "iife",
        **kwargs
    )

def tf_ts_config(**kwargs):
    """TensorBoard wrapper for the rule for a TypeScript configuration."""

    ts_config(**kwargs)

def tf_ts_library(strict_checks = True, **kwargs):
    """TensorBoard wrapper for the rule for a TypeScript library.

    Args:
      strict_checks: whether to enable stricter type checking. Default is True.
          Please use `strict_checks = False` for only Polymer based targets.
      **kwargs: keyword arguments to ts_library build rule.
    """
    tsconfig = "//:tsconfig.json"

    if strict_checks == False:
        tsconfig = "//:tsconfig-lax"
    elif "test_only" in kwargs and kwargs.get("test_only"):
        tsconfig = "//:tsconfig-test"
    kwargs.setdefault("deps", []).append("@npm//tslib")

    ts_library(tsconfig = tsconfig, **kwargs)

def tf_ts_devserver(**kwargs):
    """TensorBoard wrapper for the rule for a TypeScript dev server."""

    ts_devserver(**kwargs)

def tf_ng_web_test_suite(runtime_deps = [], bootstrap = [], deps = [], **kwargs):
    """TensorBoard wrapper for the rule for a Karma web test suite.

    It has Angular specific configurations that we want as defaults.
    """

    kwargs.setdefault("tags", []).append("webtest")
    karma_web_test_suite(
        srcs = [
            "//tensorboard/webapp/testing:require_js_karma_config.js",
        ],
        bootstrap = bootstrap + [
            "@npm//:node_modules/zone.js/dist/zone-testing-bundle.js",
            "@npm//:node_modules/reflect-metadata/Reflect.js",
            "@npm//:node_modules/@angular/localize/bundles/localize-init.umd.js",
        ],
        runtime_deps = runtime_deps + [
            "//tensorboard/webapp/testing:initialize_testbed",
        ],
        deps = deps + [
            "//tensorboard/webapp/testing:test_support_lib",
        ],
        # Lodash runtime dependency that is compatible with requirejs for karma.
        static_files = [
            "@npm//:node_modules/lodash/lodash.js",
            "@npm//:node_modules/d3/dist/d3.js",
            "@npm//:node_modules/three/build/three.js",
        ],
        **kwargs
    )

def tf_svg_bundle(name, srcs, out):
    native.genrule(
        name = name,
        srcs = srcs,
        outs = [out],
        cmd = "$(execpath //tensorboard/tools:mat_bundle_icon_svg) $@ $(SRCS)",
        tools = [
            "//tensorboard/tools:mat_bundle_icon_svg",
        ],
    )


