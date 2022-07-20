load("//tensorboard/defs:defs.bzl")

package(default_visibility = ["//tensorboard:internal"])

licenses(["notice"])


genrule(
    name = "inline_palette",
    srcs = [
        "_variable.scss",
        "_tb_theme.template.scss",
    ],
    outs = ["_tb_theme.scss"],
    cmd = "cat $(SRCS) > $@",
)
