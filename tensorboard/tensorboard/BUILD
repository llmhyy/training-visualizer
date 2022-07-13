# Description:
# TensorBoard, a dashboard for investigating TensorFlow

load("//tensorboard/defs:web.bzl", "tf_web_library")
load("//tensorboard/defs:zipper.bzl", "tensorboard_zip_file")

package(default_visibility = [":internal"])

licenses(["notice"])

exports_files(["LICENSE"])  # Needed for internal repo.

package_group(
    name = "internal",
    packages = ["//tensorboard/..."],
)

# The standard TensorBoard binary that serves the webapp.
# The two //tensorboard/summary lines are to suppress an
# annoying startup warning emitted by TensorFlow that
# "Limited tf.compat.v2.summary API due to missing TensorBoard
# installation.


# The public TensorBoard python library, bundled with the pip package and
# available via 'import tensorboard as tb' once installed.


# The dependencies needed to initialize the `tensorboard` module itself,
# which are not sufficient to resolve all of its lazy imports. Use only
# if you're intending to link in a proper subset of TensorBoard's public
# API, you're linking in that subset explicitly in your downstream
# target, and you know what you're doing.




tensorboard_zip_file(
    name = "webfiles",
    deps = [":assets"],
)

tf_web_library(
    name = "assets",
    srcs = [
        "//tensorboard/webapp:index.html",
        "//tensorboard/webapp:index.js",
        "//tensorboard/webapp:svg_bundle",
    ],
    path = "/",
    deps = [
        "//tensorboard/plugins/debugger_v2/tf_debugger_v2_plugin/views/source_code/monaco:monaco_editor",
        "//tensorboard/plugins/debugger_v2/tf_debugger_v2_plugin/views/source_code/monaco:monaco_languages",
        "@com_google_fonts_roboto",
    ],
)

# This is a dummy rule used as a numpy dependency in open-source.
# We expect numpy to already be installed on the system, e.g. via
# `pip install numpy`
py_library(name = "expect_numpy_installed")

# This is a dummy rule used as a futures dependency in open-source.
# We expect futures to already be installed on the system, e.g. via
# `pip install futures`
py_library(name = "expect_futures_installed")

# This is a dummy rule used as a grpc dependency in open-source.
# We expect grpc to already be installed on the system, e.g. via
# `pip install grpcio`
py_library(name = "expect_grpc_installed")

# This is a dummy rule used as a grpc_testing dependency in open-source.
# We expect grpc_testing to already be installed on the system, e.g. via
# `pip install grpcio_testing`
py_library(name = "expect_grpc_testing_installed")

# This is a dummy rule used as a TensorFlow dependency in open-source.
# We expect TensorFlow to already be installed on the system, e.g. via
# `pip install tensorflow`
py_library(name = "expect_tensorflow_installed")

# This is a dummy rule used as a TensorFlow Datasets dependency in open-source.
# We expect TensorFlow Datasets to already be installed on the system, e.g. via
# `pip install tensorflow_datasets`
py_library(name = "expect_tensorflow_datasets_installed")

# This is a dummy rule used as a absl-py dependency in open-source.
# We expect absl-py to already be installed on the system, e.g. via
# `pip install absl-py`
py_library(name = "expect_absl_app_installed")

# This is a dummy rule used as a absl-py dependency in open-source.
# We expect absl-py to already be installed on the system, e.g. via
# `pip install absl-py`
py_library(name = "expect_absl_flags_installed")

# This is a dummy rule used as a absl-py dependency in open-source.
# We expect absl-py to already be installed on the system, e.g. via
# `pip install absl-py`
py_library(name = "expect_absl_flags_argparse_flags_installed")

# This is a dummy rule used as a absl-py dependency in open-source.
# We expect absl-py to already be installed on the system, e.g. via
# `pip install absl-py`
py_library(name = "expect_absl_logging_installed")

# This is a dummy rule used as a absl-py dependency in open-source.
# We expect absl-py to already be installed on the system, e.g. via
# `pip install absl-py`
py_library(name = "expect_absl_testing_absltest_installed")

# This is a dummy rule used as a google_auth dependency in open-source.
# We expect google_auth to already be installed on the system, e.g., via
# `pip install google-auth`.
py_library(name = "expect_google_auth_installed")

# This is a dummy rule used as a google_auth oauthlib_dependency in open-source.
# We expect google_auth_oauthlib to already be installed on the system, e.g., via
# `pip install google-auth-oauthlib`.
py_library(name = "expect_google_auth_oauthlib_installed")

# This is a dummy rule used as a pkg-resources dependency in open-source.
# We expect pkg-resources to already be installed on the system, e.g., via
# `pip install setuptools`.
py_library(name = "expect_pkg_resources_installed")

# This is a dummy rule used as a requests dependency in open-source.
# We expect requests to already be installed on the system, e.g., via
# `pip install requests`.
py_library(name = "expect_requests_installed")

# This is a dummy rule used as a pandas dependency in open-source.
# We expect pandas to already be installed on the system, e.g. via
# `pip install pandas`.
# NOTE: Unlike other parallel dependencies in this file, pandas is an
# optional dependency.
py_library(name = "expect_pandas_installed")

filegroup(
    name = "tf_web_library_default_typings",
    srcs = [
        # Ordering probably matters.
        "@com_microsoft_typescript//:lib.es6.d.ts",
        "@io_angular_clutz//:src/resources/closure.lib.d.ts",
        "//tensorboard/defs:clutz.d.ts",
    ],
    visibility = ["//visibility:public"],
)

alias(
    name = "summary",
    actual = "//tensorboard/summary",
    visibility = ["//tensorboard:internal"],
)



