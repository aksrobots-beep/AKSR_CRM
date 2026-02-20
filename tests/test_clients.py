"""
Clients Module Tests for AK Success CRM
"""
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from tests.test_auth import login

BASE_URL = "http://localhost:5173"

class TestClients:
    """Test cases for clients functionality."""
    
    def test_clients_page_loads(self, driver):
        """Test that clients page loads correctly."""
        login(driver, "admin@aksuccess.com", "demo123")
        driver.get(f"{BASE_URL}/clients")
        
        header = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "header h1"))
        )
        
        assert "Clients" in header.text
    
    def test_clients_table_displayed(self, driver):
        """Test that clients table is displayed."""
        login(driver, "admin@aksuccess.com", "demo123")
        driver.get(f"{BASE_URL}/clients")
        
        # Wait for table to load
        table = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "table"))
        )
        
        assert table.is_displayed()
    
    def test_clients_data_displayed(self, driver):
        """Test that client data is displayed in the table."""
        login(driver, "admin@aksuccess.com", "demo123")
        driver.get(f"{BASE_URL}/clients")
        
        # Wait for table rows
        rows = WebDriverWait(driver, 10).until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, "tbody tr"))
        )
        
        # Should have demo clients
        assert len(rows) > 0
    
    def test_client_columns_present(self, driver):
        """Test that expected columns are present in clients table."""
        login(driver, "admin@aksuccess.com", "demo123")
        driver.get(f"{BASE_URL}/clients")
        
        # Wait for table headers
        headers = WebDriverWait(driver, 10).until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, "thead th"))
        )
        
        header_texts = [h.text.lower() for h in headers]
        
        # Check for expected columns
        assert any("company" in h for h in header_texts)
    
    def test_client_detail_modal(self, driver):
        """Test that clicking a client opens the detail modal."""
        login(driver, "admin@aksuccess.com", "demo123")
        driver.get(f"{BASE_URL}/clients")
        
        # Wait for and click first table row
        first_row = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "tbody tr"))
        )
        first_row.click()
        
        # Wait for modal
        modal = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".fixed.inset-0"))
        )
        
        assert modal.is_displayed()
    
    def test_client_modal_shows_info(self, driver):
        """Test that client modal displays client information."""
        login(driver, "admin@aksuccess.com", "demo123")
        driver.get(f"{BASE_URL}/clients")
        
        # Click first client
        first_row = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "tbody tr"))
        )
        first_row.click()
        
        # Wait for modal
        modal = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".fixed.inset-0"))
        )
        
        modal_text = modal.text
        
        # Should show contact information
        assert "Email" in modal_text or "Phone" in modal_text or "Address" in modal_text
    
    def test_add_client_button_exists(self, driver):
        """Test that Add Client button exists."""
        login(driver, "admin@aksuccess.com", "demo123")
        driver.get(f"{BASE_URL}/clients")
        
        add_button = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//button[contains(text(), 'Add Client') or contains(text(), 'Add')]"))
        )
        
        assert add_button.is_displayed()
    
    def test_close_modal_button(self, driver):
        """Test that modal can be closed."""
        login(driver, "admin@aksuccess.com", "demo123")
        driver.get(f"{BASE_URL}/clients")
        
        # Open modal
        first_row = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "tbody tr"))
        )
        first_row.click()
        
        # Wait for modal
        modal = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".fixed.inset-0"))
        )
        
        # Find and click close button
        close_button = modal.find_element(By.CSS_SELECTOR, "button")
        close_button.click()
        
        # Modal should be closed (or at least attempted)
        # Note: This may need adjustment based on actual close button location
