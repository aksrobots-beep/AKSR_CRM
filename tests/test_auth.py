"""
Authentication Tests for AK Success CRM
"""
import pytest
import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = "http://localhost:5173"

def login(driver, email, password):
    """Helper function to perform login."""
    driver.get(f"{BASE_URL}/login")
    
    # Wait for login page to fully load
    email_input = WebDriverWait(driver, 15).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='email']"))
    )
    
    # Enter credentials
    password_input = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
    
    email_input.clear()
    email_input.send_keys(email)
    password_input.clear()
    password_input.send_keys(password)
    
    # Click login button
    login_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
    login_button.click()
    
    # Wait for redirect to dashboard
    WebDriverWait(driver, 15).until(
        EC.url_to_be(f"{BASE_URL}/")
    )

class TestAuthentication:
    """Test cases for authentication functionality."""
    
    def test_login_page_loads(self, driver):
        """Test that the login page loads correctly."""
        driver.get(f"{BASE_URL}/login")
        
        # Wait for page to fully load
        time.sleep(2)
        
        # Check page title
        assert "AK Success CRM" in driver.title
        
        # Wait for login form elements to be visible
        email_input = WebDriverWait(driver, 15).until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='email']"))
        )
        password_input = WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='password']"))
        )
        login_button = WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "button[type='submit']"))
        )
        
        assert email_input.is_displayed()
        assert password_input.is_displayed()
        assert login_button.is_displayed()
    
    def test_login_with_valid_credentials(self, driver):
        """Test login with valid credentials."""
        login(driver, "admin@aksuccess.com", "demo123")
        
        # Should be redirected to dashboard
        assert driver.current_url == f"{BASE_URL}/"
        
        # Check that sidebar is visible (user is logged in)
        sidebar = WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.TAG_NAME, "aside"))
        )
        assert sidebar.is_displayed()
    
    def test_login_with_invalid_credentials(self, driver):
        """Test login with invalid credentials."""
        driver.get(f"{BASE_URL}/login")
        
        # Wait for and enter invalid credentials
        email_input = WebDriverWait(driver, 15).until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='email']"))
        )
        password_input = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
        
        email_input.send_keys("invalid@test.com")
        password_input.send_keys("wrongpassword")
        
        # Click login button
        login_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
        login_button.click()
        
        # Should show error message
        error_message = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".bg-danger-50"))
        )
        assert error_message.is_displayed()
        
        # Should still be on login page
        assert "/login" in driver.current_url
    
    def test_login_as_ceo(self, driver):
        """Test login as CEO role."""
        login(driver, "ceo@aksuccess.com", "demo123")
        
        # Wait for sidebar
        sidebar = WebDriverWait(driver, 15).until(
            EC.visibility_of_element_located((By.TAG_NAME, "aside"))
        )
        sidebar_text = sidebar.text.lower()
        
        # CEO should see HR and Accounts menu items
        assert "hr" in sidebar_text or "leave" in sidebar_text
        assert "accounts" in sidebar_text
    
    def test_login_as_technician(self, driver):
        """Test login as Technician role."""
        login(driver, "tech@aksuccess.com", "demo123")
        
        # Technician should see sidebar
        sidebar = WebDriverWait(driver, 15).until(
            EC.visibility_of_element_located((By.TAG_NAME, "aside"))
        )
        assert sidebar.is_displayed()
    
    def test_demo_account_buttons(self, driver):
        """Test that demo account quick-fill buttons work."""
        driver.get(f"{BASE_URL}/login")
        
        # Wait for page to load
        WebDriverWait(driver, 15).until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='email']"))
        )
        
        # Find demo account buttons
        demo_buttons = WebDriverWait(driver, 10).until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, ".grid button"))
        )
        assert len(demo_buttons) > 0
        
        # Click the first demo button
        demo_buttons[0].click()
        
        # Wait a moment for field to populate
        time.sleep(0.5)
        
        # Check that email field is populated
        email_input = driver.find_element(By.CSS_SELECTOR, "input[type='email']")
        assert email_input.get_attribute("value") != ""
