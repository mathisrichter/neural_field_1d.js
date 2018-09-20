var sampling_points = 120;
var u;
var time_step = 25;
var tau = 500.0;
var resting_level = -50.0;
var noise_strength = 0.2;
var current_input = [];
var previous_input_sum = [];
var kernel;
var selective_kernel;
var multi_peak_kernel;
var working_memory_kernel;
var global_inhibition_strength = -10.5;

var KernelStateEnum = Object.freeze({"selective":1, "multi_peak":2, "working_memory":3});
var show_help;

var base01_color = "#586e75";
var base00_color = "#657b83";
var base0_color = "#839496";
var yellow_color = "#b58900";
var orange_color = "#cb4b16";
var red_color = "#dc322f";
var blue_color = "#268bd2";

var stroke_weight = 5;
var distance_per_sample;
var display_threshold_y;
var container_name = "DFTcontainer";
var button_selective;
var button_multi_peak;
var button_working_memory;
var button_help;
var kernel_name_display;
var canvas;

var oscillators = [];


class KernelSelectorButton
{
  constructor(label, width, height)
  {
    this.label = label;
    this.width = width;
    this.height = height;
    this.x = 0;
    this.y = 0;
    this.selected = false;
    this.hovered = false;
  }

  position(x, y)
  {
    this.x = x;
    this.y = y;
  }

  select(state)
  {
    this.selected = state;
  }

  hover(state)
  {
    this.hovered = state;
  }

  draw()
  {
    push();
    translate(this.x, this.y);

    if (this.selected)
    {
      fill(base01_color);
    }
    else
    {
      noFill();
    }

    if (this.hovered)
    {
      stroke(base0_color);
    }
    else
    {
      stroke(base01_color);
    }
    strokeWeight(stroke_weight);
    rect(0, 0, this.width, this.height);
    pop();
  }

  isMouseOver()
  {
    return mouseX > this.x && mouseX < this.x + this.width && mouseY > this.y && mouseY < this.y + this.height;
  }
}


class HelpButton
{
  constructor(radius)
  {
    this.x = 0;
    this.y = 0;
    this.radius = radius;
    this.hovered = false;
  }

  position(x, y)
  {
    this.x = x;
    this.y = y;
  }

  hover(state)
  {
    this.hovered = state;
  }

  isMouseOver()
  {
    return dist(mouseX, mouseY, this.x, this.y) < button_help.radius;
  }

  draw()
  {
    var color = base01_color;

    if (this.hovered)
    {
      color = base0_color;
    }

    push();

    translate(this.x, this.y);

    textAlign(LEFT, BOTTOM);
    noStroke();
    fill(color);
    text("?", 10 - this.radius, -1 + this.radius);

    stroke(color);
    noFill();
    ellipse(0, 0, this.radius * 2);
    pop();
  }
}


Array.prototype.SumArray = function (arr)
{
  var sum = [];
  if (arr != null && this.length == arr.length)
  {
    for (var i = 0; i < arr.length; i++)
    {
      sum.push(this[i] + arr[i]);
    }
  }

  return sum;
}


function setup()
{
  for (let i = 0; i < sampling_points; i++)
  {
    oscillators[i] = new p5.Oscillator();
    oscillators[i].setType('sine');
    oscillators[i].freq(60 + 15 * i);
    oscillators[i].amp(0);
    oscillators[i].start();
  }

  u = new Array(sampling_points);
  reinitializeActivation();

  current_input = new Array(sampling_points);
  previous_input_sum = new Array(sampling_points);
  reinitializeInput();

  // selective kernel
  selective_kernel = gaussian(40.0, 7, 3.0, 15);

  // multi peak kernel
  var multi_peak_exc = gaussian(20.0, 7, 6.0, 15);
  var multi_peak_inh = gaussian(-10.0, 7, 60.0, 15);
  multi_peak_kernel = multi_peak_exc.SumArray(multi_peak_inh);

  // working memory kernel
  var working_memory_exc = gaussian(60.0, 7, 6.0, 15);
  var working_memory_inh = gaussian(-20.0, 7, 60.0, 15);
  working_memory_kernel = working_memory_exc.SumArray(working_memory_inh);

  button_selective = new KernelSelectorButton("selective field", 30, 30);
  button_multi_peak = new KernelSelectorButton("multi-peak field", 30, 30);
  button_working_memory = new KernelSelectorButton("working memory field", 30, 30);

  // the selective kernel is the default
  button_selective.select(true);
  changeKernel(KernelStateEnum.selective);
  kernel_name_display = button_selective.label;

  button_help = new HelpButton(20);
  show_help = false;

  canvas = createCanvas(100, 100);
  canvas.parent(container_name);
  resize();
}


function resize()
{
  var container_width = document.getElementById(container_name).offsetWidth;
  var container_height = document.getElementById(container_name).offsetHeight;

  resizeCanvas(container_width, container_height);

  distance_per_sample = container_width / (sampling_points - 1);
  display_threshold_y = container_height / 2.0;
}


function draw()
{
  background("#002b36");
  textFont("Helvetica", 35);

  euler();

  noFill();
  strokeWeight(stroke_weight);

  // draw threshold --------------------------------------
  push();
  stroke(base01_color);
  translate(0, display_threshold_y);
  line(0, 0, width, 0);
  pop();

  // draw input ------------------------------------------
  push();
  stroke(yellow_color);
  translate(0, display_threshold_y);
  beginShape();
  for (let i = 0; i < u.length; i++)
  {
    vertex(distance_per_sample * i, -1.0 * (previous_input_sum[i] + current_input[i]));
  }
  endShape();

  if (show_help)
  {
    noStroke();
    fill(yellow_color);
    text("input", width - 100, -20);
  }

  pop();

  // draw activation -------------------------------------
  push();
  translate(0, display_threshold_y);
  stroke(orange_color);
  beginShape();
  for (let i = 0; i < u.length; i++)
  {
    vertex(distance_per_sample * i, -1.0 * u[i]);
    if (u[i] > 0)
    {
      oscillators[i].amp(u[i] * 0.0015, 0.1);
    }
    else
    {
      oscillators[i].amp(0.0, 0.2);
    }
  }
  endShape();

  if (show_help)
  {
    noStroke();
    fill(orange_color);
    text("activation", width - 170, 90);
  }
  pop();

  // draw manual -----------------------------------------
  if (show_help)
  {
    push();
    noStroke();
    fill(blue_color);

    var manual_text = "Control input with your mouse.\nClick to fix current input.\nScroll to change resting level.\nPress Escape to reset field.";

    text(manual_text, 20, 20, width - 50, height);

    pop();
  }

  // draw buttons ----------------------------------------
  var margin = 30;
  var separator = 10;
  button_working_memory.position(width - (button_working_memory.width + margin), height - button_working_memory.height - margin);
  button_working_memory.draw();

  button_multi_peak.position(button_working_memory.x - separator - button_multi_peak.width, height - button_multi_peak.height - margin);
  button_multi_peak.draw();

  button_selective.position(button_multi_peak.x - separator - button_selective.width, height - button_selective.height - margin);
  button_selective.draw();

  push();
  fill(base01_color);
  textAlign(RIGHT, BOTTOM);
  text(kernel_name_display, button_selective.x - margin, height - margin + 4);
  pop();

  // draw help -------------------------------------------
  button_help.position(margin + button_help.radius, height - margin - button_help.radius);
  button_help.draw();
}


function mouseMoved()
{
  var mousePosition = [constrain(mouseX, 0, width), constrain(mouseY, 0, height)];
  var amplitude = 0.0;
  if (mousePosition[0] > 0 && mousePosition[0] < width && mousePosition[1] < display_threshold_y && mousePosition[1] > 0)
  {
    amplitude = -1.0 * (mousePosition[1] - display_threshold_y);
  }
  current_input = gaussian(amplitude, mousePosition[0]/distance_per_sample, 8.0, sampling_points);

  // if mouse is over one of the buttons, mark it for hovering
  if (button_selective.isMouseOver())
  {
    button_selective.hover(true);
    button_multi_peak.hover(false);
    button_working_memory.hover(false);
    kernel_name_display = button_selective.label;
  }
  else if (button_multi_peak.isMouseOver())
  {
    button_selective.hover(false);
    button_multi_peak.hover(true);
    button_working_memory.hover(false);
    kernel_name_display = button_multi_peak.label;
  }
  else if (button_working_memory.isMouseOver())
  {
    button_selective.hover(false);
    button_multi_peak.hover(false);
    button_working_memory.hover(true);
    kernel_name_display = button_working_memory.label;
  }
  else
  {
    button_selective.hover(false);
    button_multi_peak.hover(false);
    button_working_memory.hover(false);

    if (button_selective.selected)
    {
      kernel_name_display = button_selective.label;
    }
    else if (button_multi_peak.selected)
    {
      kernel_name_display = button_multi_peak.label;
    }
    else if (button_working_memory.selected)
    {
      kernel_name_display = button_working_memory.label;
    }
  }

  if (button_help.isMouseOver())
  {
    button_help.hover(true);
    show_help = true;
  }
  else
  {
    button_help.hover(false);
    show_help = false;
  }
}


function mouseClicked()
{
  if (mouseY < display_threshold_y)
  {
    previous_input_sum = previous_input_sum.SumArray(current_input);
  }

  if (button_selective.isMouseOver())
  {
    button_selective.select(true);
    button_multi_peak.select(false);
    button_working_memory.select(false);
    changeKernel(KernelStateEnum.selective);
  }
  else if (button_multi_peak.isMouseOver())
  {
    button_selective.select(false);
    button_multi_peak.select(true);
    button_working_memory.select(false);
    changeKernel(KernelStateEnum.multi_peak);
  }
  else if (button_working_memory.isMouseOver())
  {
    button_selective.select(false);
    button_multi_peak.select(false);
    button_working_memory.select(true);
    changeKernel(KernelStateEnum.working_memory);
  }
}


function mouseWheel(event)
{
  if (mouseX < width && mouseY < height)
  {
    resting_level += event.delta

    var padding = 10;
    var threshold_padding = 0.05;
 
    if (resting_level > -threshold_padding)
    {
      resting_level = -threshold_padding
    }
    else if (resting_level < -1 * (height / 2.) + padding)
    {
      resting_level = -1 * (height / 2.) + padding;
    }

    // block page scrolling
    return false;
  }

  return true;
}


function keyPressed()
{
  if (keyCode == ESCAPE)
  {
    reinitializeInput();
    reinitializeActivation();
  }
}


function windowResized()
{
  resize();
}


function changeKernel(kernel_state)
{
  if (kernel_state == KernelStateEnum.selective)
  {
    kernel = selective_kernel;
    global_inhibition_strength = -20.5;

  }
  else if (kernel_state == KernelStateEnum.multi_peak)
  {
    kernel = multi_peak_kernel;
    global_inhibition_strength = 0.0;
  }
  else if (kernel_state == KernelStateEnum.working_memory)
  {
    kernel = working_memory_kernel;
    global_inhibition_strength = -2.0;
  }
}


function euler()
{
  var global_inhibition = 0;
  for (var i = 0; i < u.length; i++)
  {
    global_inhibition += sigmoid(u[i]);
  }

  for (var i = 0; i < u.length; i++)
  {
    // compute lateral interaction
    var interaction = 0;
    for (var k = 0; k < kernel.length; k++)
    {
      neighbor_index = i + k - (Math.floor(kernel.length / 2.0));
      if (neighbor_index < 0 || neighbor_index >= u.length)
      {
        interaction_contribution = 0;
      }
      else
      {
        interaction_contribution = kernel[k] * sigmoid(u[neighbor_index]);
      }

      interaction += interaction_contribution;
    }

    var du = -u[i] + resting_level + current_input[i] + previous_input_sum[i] + interaction + global_inhibition_strength * global_inhibition;
    u[i] = u[i] + (time_step / tau) * du + Math.sqrt(time_step) * noise_strength * getRandom(-1, 1);
  }
}


function gaussian(amplitude, mu, sigma, size)
{
  var gaussian = new Array(size);

  for (var i = 0; i < gaussian.length; i++)
  {
    gaussian[i] = amplitude * Math.exp(-(Math.pow(i - mu, 2)) / (2 * sigma));
  }

  return gaussian;
}

function sigmoid(x)
{
  return 1.0 / (1 + Math.exp(-1.0 * x));
}

function getRandom(min, max)
{
  return Math.random() * (max - min) + min;
}

function reinitializeInput()
{
  for (var i = 0; i < sampling_points; i++)
  {
    current_input[i] = 0;
    previous_input_sum[i] = 0;
  }
}

function reinitializeActivation()
{
  for (var i = 0; i < sampling_points; i++)
  {
    u[i] = resting_level;
  }
}

