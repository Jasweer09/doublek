from PIL import Image

# Open an image file
input_path = "images/IcelandicHorse.jpeg"
output_path = "images/IcelandicHorse.jpeg"

# Desired dimensions
custom_width = 300
custom_height = 200

# Open and resize the image
with Image.open(input_path) as img:
    # Resize the image
    resized_img = img.resize((custom_width, custom_height), Image.Resampling.LANCZOS)
    
    # Save the resized image
    resized_img.save(output_path)
    print(f"Image saved as {output_path}")
