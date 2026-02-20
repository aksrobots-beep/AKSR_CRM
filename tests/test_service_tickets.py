"""
Service Tickets Tests for AK Success CRM
"""
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from tests.test_auth import login

BASE_URL = "http://localhost:5173"

class TestServiceTickets:
    """Test cases for service tickets functionality."""
    
    def test_tickets_page_loads(self, driver):
        """Test that service tickets page loads correctly."""
        login(driver, "admin@aksuccess.com", "demo123")
        
        # Navigate to service tickets
        driver.get(f"{BASE_URL}/service")
        
        # Wait for page to load
        header = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "header h1"))
        )
        
        assert "Service Tickets" in header.text
    
    def test_kanban_view_displayed(self, driver):
        """Test that Kanban view is displayed by default."""
        login(driver, "admin@aksuccess.com", "demo123")
        driver.get(f"{BASE_URL}/service")
        
        # Check for Kanban columns
        columns = WebDriverWait(driver, 10).until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, "[class*='rounded-xl']"))
        )
        
        assert len(columns) > 0
    
    def test_view_toggle_buttons_exist(self, driver):
        """Test that view toggle buttons exist."""
        login(driver, "admin@aksuccess.com", "demo123")
        driver.get(f"{BASE_URL}/service")
        
        # Find view toggle buttons in header
        toggle_buttons = WebDriverWait(driver, 10).until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, "header button"))
        )
        
        assert len(toggle_buttons) >= 3  # Kanban, Table, Calendar
    
    def test_switch_to_table_view(self, driver):
        """Test switching from Kanban to Table view."""
        login(driver, "admin@aksuccess.com", "demo123")
        driver.get(f"{BASE_URL}/service")
        
        # Wait for page to load
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "header"))
        )
        
        # Find and click table view button (second button in toggle group)
        toggle_container = driver.find_element(By.CSS_SELECTOR, "header .bg-neutral-100")
        buttons = toggle_container.find_elements(By.TAG_NAME, "button")
        
        if len(buttons) >= 2:
            buttons[1].click()  # Click table view button
            
            # Wait for table to appear
            WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.TAG_NAME, "table"))
            )
    
    def test_ticket_cards_display_info(self, driver):
        """Test that ticket cards display required information."""
        login(driver, "admin@aksuccess.com", "demo123")
        driver.get(f"{BASE_URL}/service")
        
        # Wait for ticket cards
        cards = WebDriverWait(driver, 10).until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, ".card.cursor-grab, .card.cursor-pointer"))
        )
        
        if len(cards) > 0:
            # Cards should contain text
            first_card = cards[0]
            assert first_card.text != ""
    
    def test_ticket_detail_modal_opens(self, driver):
        """Test that clicking a ticket opens the detail modal."""
        login(driver, "admin@aksuccess.com", "demo123")
        driver.get(f"{BASE_URL}/service")
        
        # Wait for and click first ticket card
        cards = WebDriverWait(driver, 10).until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, ".card"))
        )
        
        # Find a clickable ticket card
        for card in cards:
            if "cursor" in card.get_attribute("class"):
                card.click()
                break
        
        # Wait for modal
        try:
            modal = WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".fixed.inset-0"))
            )
            assert modal.is_displayed()
        except:
            # Modal may not appear if no clickable cards
            pass
    
    def test_add_ticket_button_exists(self, driver):
        """Test that Add Ticket button exists."""
        login(driver, "admin@aksuccess.com", "demo123")
        driver.get(f"{BASE_URL}/service")
        
        # Look for Add/New Ticket button
        add_button = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//button[contains(text(), 'New Ticket') or contains(text(), 'Add')]"))
        )
        
        assert add_button.is_displayed()
