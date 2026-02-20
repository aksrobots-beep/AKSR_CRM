import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

BASE_URL = "http://localhost:5173"

@pytest.fixture(scope="function")
def driver():
    """Create a new browser instance for each test."""
    chrome_options = Options()
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    # Uncomment for headless mode:
    # chrome_options.add_argument("--headless=new")
    
    # Let Selenium manage the driver automatically
    driver = webdriver.Chrome(options=chrome_options)
    driver.implicitly_wait(10)
    
    yield driver
    
    driver.quit()

@pytest.fixture
def logged_in_driver(driver):
    """Provide a driver that's already logged in as admin."""
    from tests.test_auth import login
    login(driver, "admin@aksuccess.com", "demo123")
    return driver
