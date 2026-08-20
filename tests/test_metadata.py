import configparser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_qgis_metadata_is_complete():
    parser = configparser.ConfigParser(interpolation=None)
    parser.read(ROOT / "georamp" / "metadata.txt", encoding="utf-8")
    general = parser["general"]

    required = {
        "name",
        "description",
        "version",
        "qgisminimumversion",
        "author",
        "email",
        "repository",
        "tracker",
        "homepage",
    }
    assert not required.difference(general)
    assert all(general[key].strip() for key in required)
    assert (ROOT / "LICENSE").is_file()


def test_readme_and_metadata_share_version():
    parser = configparser.ConfigParser(interpolation=None)
    parser.read(ROOT / "georamp" / "metadata.txt", encoding="utf-8")
    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    assert f"## {parser['general']['version']} " in changelog
