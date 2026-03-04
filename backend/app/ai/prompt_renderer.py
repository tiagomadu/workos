"""Jinja2 template renderer for AI prompts."""

import os

from jinja2 import Environment, FileSystemLoader

_template_dir = os.path.join(os.path.dirname(__file__), "prompts")

_env = Environment(
    loader=FileSystemLoader(_template_dir),
    autoescape=False,
    trim_blocks=True,
    lstrip_blocks=True,
)


def render_prompt(template_name: str, **kwargs) -> str:
    template = _env.get_template(template_name)
    return template.render(**kwargs)
